import { Banknote, FileText, FolderOpen, Landmark, MailQuestion, NotebookPen, ScanSearch, Ship } from "lucide-react";
import type { TimelineEvent } from "@/data/types";
import { cn } from "@/lib/utils";

export const timelineKindMeta: Record<TimelineEvent["kind"], { label: string; icon: typeof FileText; tone: string }> = {
  document: { label: "Document", icon: FileText, tone: "text-fg-muted" },
  screening: { label: "Screening", icon: ScanSearch, tone: "text-risk-review" },
  case: { label: "Case", icon: FolderOpen, tone: "text-info" },
  payment: { label: "Payment", icon: Banknote, tone: "text-accent" },
  shipment: { label: "Shipment", icon: Ship, tone: "text-fg-muted" },
  registry: { label: "Registry", icon: Landmark, tone: "text-finding" },
  note: { label: "Note", icon: NotebookPen, tone: "text-fg-muted" },
  request: { label: "Request", icon: MailQuestion, tone: "text-risk-review" },
};

export function TimelineKindIcon({ kind, className }: { kind: TimelineEvent["kind"]; className?: string }) {
  const m = timelineKindMeta[kind];
  const Icon = m.icon;
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-xs border border-border bg-surface-2", m.tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{m.label}</span>
    </span>
  );
}
