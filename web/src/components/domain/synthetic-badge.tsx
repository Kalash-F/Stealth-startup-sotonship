import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Marks fictional records and illustrative benchmark bands (plan.md §0.5). */
export function SyntheticBadge({ label = "Fictional data", className }: { label?: string; className?: string }) {
  return (
    <Badge tone="outline" className={className}>
      <FlaskConical aria-hidden className="size-3" />
      {label}
    </Badge>
  );
}
