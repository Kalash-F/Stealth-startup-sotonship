import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/** Page title block used by every application screen. */
export function PageHeader({
  title,
  crumbs,
  description,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode;
  crumbs?: Crumb[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 border-b border-border px-4 pb-5 pt-5 lg:px-6", className)}>
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-small text-fg-subtle">
            {crumbs.map((c, i) => (
              <li key={c.label} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-fg">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-fg-muted">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-page font-semibold leading-7 tracking-[-0.015em] text-fg">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-body text-fg-muted">{description}</p> : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
