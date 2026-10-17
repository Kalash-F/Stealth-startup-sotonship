"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/domain/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Container } from "./primitives";

const links = [
  { href: "/#follow-the-money", label: "The pattern" },
  { href: "/#evidence", label: "Evidence" },
  { href: "/#workspace", label: "Workspace" },
  { href: "/#network", label: "Network" },
  { href: "/app", label: "Demo workspace" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onResize = () => window.innerWidth >= 900 && setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header className={cn("theme-night sticky top-0 z-40 border-b bg-bg/95 text-fg backdrop-blur transition-colors", scrolled || open ? "border-border" : "border-transparent")}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-fg focus:px-3 focus:py-2 focus:text-sm focus:text-bg"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Home" className="text-fg">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 min-[900px]:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-2 text-[14px] text-fg-muted transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 min-[900px]:flex">
          <Button asChild variant="ghost" size="md">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="md">
            <Link href="/request-demo">Request a demo</Link>
          </Button>
        </div>

        <Button
          ref={buttonRef}
          variant="secondary"
          size="md"
          className="min-[900px]:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
          Menu
        </Button>
      </Container>

      {open ? (
        <div id="mobile-menu" className="border-t border-border bg-bg min-[900px]:hidden">
          <Container className="py-4">
            <nav aria-label="Mobile" className="flex flex-col">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-3 text-[16px] text-fg"
                >
                  {l.label}
                </Link>
              ))}
              <Link href="/sign-in" onClick={() => setOpen(false)} className="border-b border-border py-3 text-[16px] text-fg">
                Sign in
              </Link>
            </nav>
            <Button asChild variant="primary" size="lg" className="mt-4 w-full">
              <Link href="/request-demo" onClick={() => setOpen(false)}>
                Request a demo
              </Link>
            </Button>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
