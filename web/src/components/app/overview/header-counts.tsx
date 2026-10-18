"use client";

import Link from "next/link";
import { caseCounts } from "@/data/workspace";
import { cn } from "@/lib/utils";
import { useLiveVersion } from "@/lib/live-cases";

/** The three counts that need action, set straight on the page header (no tiles). Each links to its filtered list; only a non-zero review-now count takes the brick. */
export function HeaderCounts() {
  useLiveVersion();
  const c = caseCounts();
  const counts = [
    { label: "Review now", value: c.reviewNow, alarm: c.reviewNow > 0, note: "Open cases scoring 60 or more", href: "/app/investigations?band=review_now" },
    { label: "Awaiting information", value: c.awaiting, alarm: false, note: "Requests out to counterparties", href: "/app/investigations?status=awaiting_info" },
    { label: "Escalated", value: c.escalated, alarm: false, note: "With the MLRO for a decision", href: "/app/investigations?status=escalated" },
  ];

  return (
    <ul aria-label="Case counts" className="flex flex-wrap items-end gap-x-10 gap-y-3">
      {counts.map((t) => (
        <li key={t.label}>
          <Link href={t.href} title={t.note} className="group block">
            <span className="block text-small text-fg-muted group-hover:text-fg">{t.label}</span>
            <span className={cn("mt-1 block font-mono text-page font-medium leading-7 tabular", t.alarm ? "text-risk-high" : "text-fg")}>{t.value}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
