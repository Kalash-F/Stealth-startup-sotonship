"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileWarning, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Where the invoice PDF comes from: the sample on the server, or the file the user picked (never re-uploaded). */
export type DocumentSource = { kind: "sample"; url: string; name: string } | { kind: "upload"; file: File; name: string };

/** A goods line found on a page, as percentages of the page so it scales with the image. */
interface Row {
  id: string;
  top: number;
  height: number;
}

interface Page {
  width: number; // CSS px at scale 1 (PDF points)
  height: number;
  rows: Row[];
  src: string | null; // object URL of the rendered page, null until painted
}

const MAX_PAGES = 10;
const RENDER_WIDTH = 1400; // device px per page: sharp at the sticky column's width on 2× screens

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The invoice the checker read, page by page, so the officer can compare it with the findings.
 * Rendered with pdf.js to images (inline PDF frames do not render on phones). Goods lines are
 * located through the PDF's own text positions and marked: flagged lines tinted, the line in focus
 * in the findings outlined. The image is a visual aid; every value on it is listed as text in the
 * findings beside it.
 */
export function InvoiceDocument({
  source,
  lines,
  flagged,
  active,
  onSelectLine,
  zoom = 1,
  className,
}: {
  zoom?: number;
  source: DocumentSource;
  lines: { id: string; description: string }[];
  flagged: Set<string>;
  active: string | null;
  onSelectLine?: (id: string) => void;
  className?: string;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [href, setHref] = useState<string | null>(source.kind === "sample" ? source.url : null);
  const lineKey = lines.map((l) => `${l.id}:${l.description}`).join("|");

  // A link to the original file: the server URL for samples, an object URL for uploads.
  useEffect(() => {
    if (source.kind === "sample") {
      setHref(source.url);
      return;
    }
    const url = URL.createObjectURL(source.file);
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const urls: string[] = [];
    setState("loading");
    setPages([]);

    (async () => {
      // The legacy build is compiled for older browsers; the modern one needs JavaScript features
      // (Map.getOrInsertComputed, Math.sumPrecise) that current Chrome and Safari do not all have.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task =
        source.kind === "upload" ? pdfjs.getDocument({ data: new Uint8Array(await source.file.arrayBuffer()) }) : pdfjs.getDocument({ url: source.url });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      if (cancelled) return;
      const count = Math.min(pdf.numPages, MAX_PAGES);
      setPageCount(pdf.numPages);

      // Find each goods line on the pages, top to bottom, in invoice order.
      const wanted = lines.map((l) => ({ id: l.id, needle: norm(l.description).slice(0, 18) })).filter((l) => l.needle.length >= 3);
      let next = 0;
      const found: Page[] = [];
      for (let n = 1; n <= count; n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1 });
        const text = await page.getTextContent();
        // Some PDFs give one text item per word, so match against whole visual lines (same baseline).
        const items = text.items
          .filter((it): it is Extract<typeof it, { str: string }> => "str" in it && it.str.trim().length > 0)
          .map((it) => {
            const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]) as [number, number];
            return { str: it.str, x, baseline: y, height: Math.max(it.height, 6) };
          })
          .sort((a, b) => a.baseline - b.baseline || a.x - b.x);
        const visual: { text: string; baseline: number; height: number }[] = [];
        let group: typeof items = [];
        const flush = () => {
          if (!group.length) return;
          group.sort((a, b) => a.x - b.x);
          visual.push({
            text: norm(group.map((g) => g.str).join(" ")),
            baseline: Math.max(...group.map((g) => g.baseline)),
            height: Math.max(...group.map((g) => g.height)),
          });
          group = [];
        };
        for (const item of items) {
          if (group.length && Math.abs(item.baseline - group[0].baseline) > 2) flush();
          group.push(item);
        }
        flush();
        const rows: Row[] = [];
        for (const line of visual) {
          const want = wanted[next];
          if (!want) break;
          if (!line.text.includes(want.needle)) continue;
          const pad = line.height * 0.55;
          rows.push({
            id: want.id,
            top: ((line.baseline - line.height - pad) / vp.height) * 100,
            height: ((line.height + pad * 2) / vp.height) * 100,
          });
          next++;
        }
        found.push({ width: vp.width, height: vp.height, rows, src: null });
      }
      if (cancelled) return;
      setPages(found);

      // Paint each page off screen and show it as an image.
      for (let n = 1; n <= count; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setPages((prev) => prev.map((p, i) => (i === n - 1 ? { ...p, src: url } : p)));
      }
      if (!cancelled) setState("ready");
    })().catch(() => {
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
      destroy?.();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // `lines` is compared by content through `lineKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, lineKey]);

  return (
    <div className={cn("grid gap-3", className)}>
      {state === "error" ? (
        <div className="grid place-items-center gap-2 rounded-md border border-dashed border-border-strong px-4 py-10 text-center">
          <FileWarning className="size-5 text-fg-subtle" aria-hidden />
          <p className="text-body text-fg-muted">This document could not be shown here.</p>
        </div>
      ) : null}

      {state !== "error" && !pages.length ? (
        <div className="grid aspect-[1/1.414] w-full place-items-center rounded-md bg-surface-2" aria-busy="true">
          <span className="flex items-center gap-2 text-small text-fg-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Opening the invoice…
          </span>
        </div>
      ) : null}

      {(state === "error" ? [] : pages).map((page, i) => (
        <div
          key={i}
          className="@container relative overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.06)]"
          style={{ aspectRatio: `${page.width} / ${page.height}`, width: `${zoom * 100}%` }}
        >
          {page.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL of a rendered page
            <img
              src={page.src}
              alt={`Page ${i + 1} of ${pageCount} of ${source.name}, as received. Its goods lines are listed as text under Goods lines.`}
              className="block h-full w-full"
            />
          ) : (
            <div className="grid h-full place-items-center" aria-busy="true">
              <Loader2 className="size-5 animate-spin text-[#57504b]" aria-label="Rendering page" />
            </div>
          )}
          <div aria-hidden className="absolute inset-0">
            {page.rows.map((row) => {
              const isFlagged = flagged.has(row.id);
              const isActive = active === row.id;
              return (
                <div
                  key={row.id}
                  onClick={() => onSelectLine?.(row.id)}
                  className={cn(
                    "absolute inset-x-[3%] cursor-pointer rounded-[3px] transition-[background-color,box-shadow] duration-150",
                    isFlagged ? "bg-risk-high/[0.07]" : "",
                    isActive ? "bg-[#ffd45c]/35 shadow-[0_0_0_2px_#1f2328]" : isFlagged ? "hover:bg-risk-high/[0.12]" : "hover:bg-black/[0.04]",
                  )}
                  style={{ top: `${row.top}%`, height: `${row.height}%` }}
                >
                  <span
                    className={cn(
                      // the tags need about 15px of row: hidden on a page narrower than ~400px, where rows are tighter
                      "absolute left-0 top-1/2 hidden h-[15px] min-w-[20px] -translate-y-1/2 items-center justify-center rounded-[3px] px-1 font-mono text-[10px] font-medium leading-none @min-[400px]:flex",
                      isFlagged ? "bg-[#922e15] text-white" : "bg-[#3a3632] text-white",
                    )}
                  >
                    {isFlagged ? "▲ " : ""}
                    {row.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {pageCount > MAX_PAGES ? (
        <p className="text-small text-fg-muted">
          Showing the first {MAX_PAGES} of {pageCount} pages.
        </p>
      ) : null}

      {href ? (
        <a
          style={{ position: "sticky", left: 0 }}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 justify-self-start text-small font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open the original PDF<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
    </div>
  );
}
