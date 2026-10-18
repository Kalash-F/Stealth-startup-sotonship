"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChartColumn,
  ChevronsUpDown,
  FolderSearch,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  UserRound,
  X,
  ScanSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/domain/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { analystById, demoUserId } from "@/data/reference";
import { caseCounts, workspace } from "@/data/workspace";
import { cn } from "@/lib/utils";
import type { Investigation } from "@/data/types";
import { restoreLiveCases, useCases } from "@/lib/live-cases";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { QuickSearch } from "./quick-search";
import { StackedPeaks } from "./stacked-peaks";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/checker", label: "Check invoice", icon: ScanSearch },
  { href: "/app/investigations", label: "Investigations", icon: FolderSearch, count: (cases: readonly Investigation[]) => caseCounts(cases).open },
  { href: "/app/entities", label: "Entities", icon: Network },
  { href: "/app/activity", label: "Recent activity", icon: History },
  { href: "/app/statistics", label: "Statistics", icon: ChartColumn },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const cases = useCases();
  const pathname = usePathname();
  return (
    <ul className="grid gap-0.5">
      {nav.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-body font-medium transition-colors duration-150",
                active ? "bg-fg text-bg" : "text-fg-muted hover:bg-fg/[0.06] hover:text-fg",
              )}
            >
              <Icon className={cn("size-4", active ? "text-bg" : "text-fg-subtle group-hover:text-fg")} aria-hidden />
              <span>{item.label}</span>
              {item.count ? <span className={cn("font-mono text-meta tabular", active ? "text-bg/75" : "text-fg-subtle")}>{item.count(cases)}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WorkspaceSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md border border-border-strong/60 bg-fg/[0.06] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-fg/[0.1]">
        <span className="flex size-7 items-center justify-center rounded-sm bg-fg font-mono text-meta font-semibold text-bg">TF</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-medium text-fg">{workspace.name}</span>
          <span className="block truncate text-meta text-fg-subtle">{workspace.org}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-fg-subtle" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuItem>
          <span className="flex size-5 items-center justify-center rounded-xs bg-accent-soft font-mono text-[9px] text-accent">TF</span>
          {workspace.name}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast("The demo has a single sample workspace.", { description: "Real deployments would list your organisation's workspaces here." })}>
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const router = useRouter();
  const me = analystById(demoUserId)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors duration-150 hover:bg-fg/[0.06]" aria-label="Open profile menu">
        <span className="flex size-7 items-center justify-center rounded-md bg-fg/10 font-mono text-meta font-medium text-fg">{me.initials}</span>
        <span className="hidden text-left md:block">
          <span className="block text-small font-medium leading-tight text-fg">{me.name}</span>
          <span className="block text-meta leading-tight text-fg-subtle">Demo persona</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          Signed in to the demo as a fictional {me.role.toLowerCase()}. No account exists.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast("Profiles are not part of the demo.")}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast("Settings are not part of the demo.")}>
          <Settings /> Workspace settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/")}>
          <LogOut /> Leave demo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Mode = "light" | "dark";
// Also read by the restore script in app/app/layout.tsx.
const modeStorageKey = "ws-mode";

/** Light (beige) or dark (graphite) workspace. Sets `data-ws-mode` on <html>; the app layout restores it before paint. */
function ModeSwitch() {
  const [mode, setMode] = React.useState<Mode>("light");

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(modeStorageKey);
    } catch {}
    const m: Mode = stored === "dark" ? "dark" : "light";
    document.documentElement.dataset.wsMode = m;
    setMode(m);
  }, []);

  const choose = (m: Mode) => {
    setMode(m);
    document.documentElement.dataset.wsMode = m;
    try {
      localStorage.setItem(modeStorageKey, m);
    } catch {}
  };

  return <ThemeToggle isDark={mode === "dark"} onToggle={(dark) => choose(dark ? "dark" : "light")} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setMobileOpen(false), [pathname]);

  // Cases made by checking invoices in this browser come back after hydration, so the first render matches the server.
  React.useEffect(() => restoreLiveCases(), []);

  // Dialogs, menus, tooltips and toasts portal to <body>, outside this subtree.
  // Put the linen theme on <body> while the workspace is mounted so they match.
  React.useEffect(() => {
    document.body.classList.add("theme-linen");
    return () => document.body.classList.remove("theme-linen");
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (
    <div className="ws-sidebar-scope flex h-full flex-col gap-5 px-3 py-4 text-fg">
      <div className="flex items-center justify-between px-1">
        <Link href="/app" className="text-fg" aria-label="Workspace overview">
          <Logo />
        </Link>
        <button className="rounded-sm p-1 text-fg-muted hover:bg-fg/[0.06] hover:text-fg lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="size-4" />
        </button>
      </div>
      <WorkspaceSwitcher />
      <nav aria-label="Workspace">
        <p className="eyebrow mb-2 px-2.5">Workspace</p>
        <NavLinks onNavigate={() => setMobileOpen(false)} />
      </nav>
      <div className="mt-auto grid gap-3 border-t border-border-strong/50 px-1 pt-4">
        <p className="text-meta leading-relaxed text-fg-subtle [text-wrap:pretty]">{workspace.dataNotice}</p>
        <Link href="/" className="group inline-flex items-center gap-1.5 text-small text-fg-muted hover:text-fg">
          <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
          Back to the website
        </Link>
      </div>
    </div>
  );

  // On desktop the shell is exactly one screen tall: the page never scrolls, long panels scroll inside themselves.
  // The navigation sits on the beige frame and the content is an inset sheet raised off it.
  // `relative` keeps absolutely positioned helpers (sr-only text) from stretching the document past the screen.
  return (
    <div className="theme-linen grain relative flex min-h-dvh flex-col bg-frame text-fg lg:h-dvh lg:overflow-hidden">
      <div className="flex lg:min-h-0 lg:flex-1">
        {/* Desktop sidebar */}
        <aside className="grain hidden w-60 shrink-0 overflow-y-auto bg-sidebar lg:block">{sidebar}</aside>

        {/* Mobile sidebar */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
            <aside className="grain absolute inset-y-0 left-0 w-72 border-r border-border-strong/50 bg-sidebar shadow-float">{sidebar}</aside>
          </div>
        ) : null}

        <div className="see-through relative isolate flex min-w-0 flex-1 flex-col bg-bg lg:mb-2 lg:mr-2 lg:min-h-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border-strong/40 lg:shadow-float">
          {/* On desktop the landscape sits in the bottom-right corner of the sheet, seen through translucent panels (`.see-through`). */}
          <StackedPeaks className="absolute bottom-0 right-0 -z-10 hidden h-[90%] w-[92%] opacity-80 lg:block" />
          <header className="ws-topbar-scope sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-topbar/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-topbar/80 lg:px-6">
            <button className="rounded-sm p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <Link href="/app" className="text-fg lg:hidden" aria-label="Workspace overview">
              <Logo showName={false} />
            </Link>
            {/* On desktop the search sits at the centre of the screen, not of the content column (15rem = sidebar width). */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full min-w-0 max-w-sm items-center gap-2 rounded-md border border-border bg-surface px-3 text-body text-fg-subtle transition-colors duration-150 hover:border-border-strong hover:text-fg-muted lg:absolute lg:left-[calc(50vw-15rem)] lg:-translate-x-1/2"
            >
              <Search className="size-4" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">Search cases, entities, invoices</span>
              <kbd className="hidden rounded-xs border border-border-strong/70 bg-bg px-1.5 py-px font-mono text-meta text-fg-muted sm:inline">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:block">
                <ModeSwitch />
              </span>
              <ProfileMenu />
            </div>
          </header>
          <main id="main" className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
