import Link from "next/link";
import { FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { investigations } from "@/data/investigations";

export default function CaseNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <FolderX className="size-8 text-fg-subtle" aria-hidden />
      <div>
        <h1 className="text-lg font-semibold text-fg">Case not found</h1>
        <p className="mt-1 max-w-md text-[13px] text-fg-muted">
          There is no case with that reference in the sample workspace. The demo holds {investigations.length} fictional cases.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link href="/app/investigations">Back to investigations</Link>
      </Button>
    </div>
  );
}
