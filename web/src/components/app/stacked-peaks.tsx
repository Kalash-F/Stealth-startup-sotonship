"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const W = 1440;
const H = 400;

/** Back layer to front: how tall each ridge may rise, how many vertices it has, which token fills it. */
const layers = [
  { scale: 1, segments: 8, fill: "var(--peak-1)" },
  { scale: 0.78, segments: 10, fill: "var(--peak-2)" },
  { scale: 0.56, segments: 9, fill: "var(--peak-3)" },
  { scale: 0.34, segments: 12, fill: "var(--peak-4)" },
];

/** Small deterministic PRNG, so server and client draw the same shape for the same seed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** One angular ridge: alternating peaks and valleys, rising toward the right edge. */
function ridge(rand: () => number, scale: number, segments: number, offset: number) {
  const pts: string[] = [];
  for (let k = 0; k <= segments; k++) {
    const t = k / segments;
    const jitter = k > 0 && k < segments ? (rand() - 0.5) * (W / segments) * 0.6 : 0;
    const x = t * W + jitter;
    const weight = 0.1 + 0.9 * Math.pow(Math.min(Math.max(x / W, 0), 1), 1.5);
    const peak = (k + offset) % 2 === 0;
    // The first vertex sits on the ground, so a ridge that starts mid-sheet tapers in instead of cutting off.
    const amp = k === 0 ? 0 : weight * scale * H * (peak ? 0.78 + 0.22 * rand() : 0.42 + 0.18 * rand());
    pts.push(`${x.toFixed(1)} ${(H - amp).toFixed(1)}`);
  }
  return `M0 ${H} L${pts.join(" L")} L${W} ${H} Z`;
}

/**
 * Haikei-style stacked peaks in the workspace's beige steps, taller on the right so titles on the
 * left stay on calm ground. Each page draws its own silhouette (seeded by the path). Decorative only.
 */
export function StackedPeaks({ className }: { className?: string }) {
  const pathname = usePathname();
  const paths = React.useMemo(() => {
    const rand = mulberry32(hash(pathname));
    return layers.map((l, i) => ({ d: ridge(rand, l.scale, l.segments, i), fill: l.fill }));
  }, [pathname]);

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("pointer-events-none select-none", className)}
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} />
      ))}
    </svg>
  );
}
