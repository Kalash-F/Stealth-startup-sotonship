"use client";

import { caseCounts } from "@/data/workspace";
import { useCases } from "@/lib/live-cases";

/** The page description's numbers, counted on the client so they include cases checked in this browser. */
export function ListDescription() {
  const c = caseCounts(useCases());
  return (
    <>
      {c.open} open cases, {c.reviewNow} at review-now priority. Priority is the sum of the flags behind each case; open a case to see the evidence.
    </>
  );
}
