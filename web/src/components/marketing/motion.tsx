"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(options: IntersectionObserverInit = { rootMargin: "0px 0px -12% 0px" }) {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") return setInView(true);
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  return [ref, inView] as const;
}

/** Fades and lifts its children once, when they enter the viewport. */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  ...props
}: { as?: React.ElementType; delay?: number } & React.HTMLAttributes<HTMLElement>) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      data-shown={inView}
      className={cn("reveal", className)}
      style={{ ["--delay" as string]: `${delay}s` }}
      {...props}
    >
      {children}
    </Tag>
  );
}
