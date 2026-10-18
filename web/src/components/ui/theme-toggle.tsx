"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Controlled mode. Leave out to let the toggle keep its own state. */
  isDark?: boolean;
  onToggle?: (isDark: boolean) => void;
  className?: string;
}

/**
 * Sliding light/dark switch: the knob carries the current mode's icon, the track shows the other.
 * Colours come from the theme tokens, so it sits on the beige and the graphite workspace alike.
 */
export function ThemeToggle({ isDark: controlled, onToggle, className }: ThemeToggleProps) {
  const [uncontrolled, setUncontrolled] = useState(true);
  const isDark = controlled ?? uncontrolled;

  const toggle = () => {
    const next = !isDark;
    if (controlled === undefined) setUncontrolled(next);
    onToggle?.(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={cn("flex h-8 w-16 shrink-0 cursor-pointer rounded-full border border-border-strong/70 bg-surface p-1 transition-colors duration-300", className)}
    >
      <span className="flex w-full items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full bg-surface-3 transition-transform duration-300",
            isDark ? "translate-x-0" : "translate-x-8",
          )}
        >
          {isDark ? <Moon className="size-4 text-fg" strokeWidth={1.5} aria-hidden /> : <Sun className="size-4 text-fg" strokeWidth={1.5} aria-hidden />}
        </span>
        <span className={cn("flex size-6 items-center justify-center rounded-full transition-transform duration-300", !isDark && "-translate-x-8")}>
          {isDark ? <Sun className="size-4 text-fg-subtle" strokeWidth={1.5} aria-hidden /> : <Moon className="size-4 text-fg-subtle" strokeWidth={1.5} aria-hidden />}
        </span>
      </span>
    </button>
  );
}
