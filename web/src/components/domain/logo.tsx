import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Wordmark: the Sentinel app mark (a dark tile with an S and a red signal dot)
 * set beside the name. The mark is a raster, shipped at 1x/2x/3x from /public/brand.
 */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size mark with a hand-made srcset; next/image adds nothing here */}
      <img
        src="/brand/sentinel-mark-24.png"
        srcSet="/brand/sentinel-mark-24.png 1x, /brand/sentinel-mark-48.png 2x, /brand/sentinel-mark-72.png 3x"
        width={24}
        height={24}
        alt=""
        aria-hidden
        className="size-6 shrink-0"
      />
      {showName ? <span className="text-[15px] font-semibold tracking-[-0.02em]">{brand.name}</span> : null}
    </span>
  );
}
