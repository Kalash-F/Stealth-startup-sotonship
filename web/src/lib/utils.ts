import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the workspace type scale (globals.css) as font sizes. Without this,
// tailwind-merge reads text-body etc. as colours and drops them next to text-fg.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["meta", "small", "body", "title", "page", "display"] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
