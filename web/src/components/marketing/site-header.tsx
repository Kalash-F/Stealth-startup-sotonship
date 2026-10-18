"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/domain/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Container } from "./primitives";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#data", label: "Data" },
  { href: "/#contact", label: "Contact" },
];

/**
 * True while the hero's own buttons are on screen, so the header doesn't repeat "Check an invoice"
 * right above them. Pages without a hero (#hero-actions) always show the header button.
 */
function useHeroActionsVisible() {
  const pathname = usePathname();
  // Start hidden on the homepage so the server render doesn't flash the button before the observer runs.
  const [visible, setVisible] = React.useState(pathname === "/");
  React.useEffect(() => {
    const el = document.getElementById("hero-actions");
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(false);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [pathname]);
  return visible;
}

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const heroActions = useHeroActionsVisible();

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
          <Button
            asChild
            variant="accent"
            size="md"
            className={cn("transition-opacity duration-200", heroActions && "pointer-events-none opacity-0")}
          >
            <Link href="/app/checker" tabIndex={heroActions ? -1 : undefined} aria-hidden={heroActions || undefined}>
              Check an invoice
            </Link>
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
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-border py-3 text-[16px] text-fg">
                  {l.label}
                </Link>
              ))}
              <Link href="/sign-in" onClick={() => setOpen(false)} className="border-b border-border py-3 text-[16px] text-fg">
                Sign in
              </Link>
            </nav>
            <Button asChild variant="accent" size="lg" className="mt-4 w-full">
              <Link href="/app/checker" onClick={() => setOpen(false)}>
                Check an invoice
              </Link>
            </Button>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
