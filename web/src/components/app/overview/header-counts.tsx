"use client";

import Link from "next/link";
import { ArrowUpRight, Clock, ShieldAlert } from "lucide-react";
import { caseCounts } from "@/data/workspace";
import { cn } from "@/lib/utils";
import { useLiveVersion } from "@/lib/live-cases";

/** The three counts that need action, set straight on the page header (no tiles). Each links to its filtered list. */
export function HeaderCounts() {
  useLiveVersion();
  const c = caseCounts();
  const counts = [
    { label: "Review now", value: c.reviewNow, icon: ShieldAlert, tone: "text-risk-high", note: "Open cases scoring 60 or more", href: "/app/investigations?band=review_now" },
    { label: "Awaiting information", value: c.awaiting, icon: Clock, tone: "text-risk-review", note: "Requests out to counterparties", href: "/app/investigations?status=awaiting_info" },
    { label: "Escalated", value: c.escalated, icon: ArrowUpRight, tone: "text-risk-high", note: "With the MLRO for a decision", href: "/app/investigations?status=escalated" },
  ];

  return (
    <ul aria-label="Case counts" className="flex flex-wrap items-end gap-x-10 gap-y-3">
      {counts.map((t) => {
        const Icon = t.icon;
        return (
          <li key={t.label}>
            <Link href={t.href} title={t.note} className="group block">
              <span className="flex items-center gap-1.5 text-small text-fg-muted group-hover:text-fg">
                <Icon className={cn("size-3.5 shrink-0", t.tone)} aria-hidden />
                {t.label}
              </span>
              <span className="mt-1 block font-mono text-page font-medium leading-7 tabular text-fg">{t.value}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
