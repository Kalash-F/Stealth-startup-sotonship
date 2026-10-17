"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  FolderSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  UserRound,
  X,
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
import { QuickSearch } from "./quick-search";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/investigations", label: "Investigations", icon: FolderSearch, count: () => caseCounts().open },
  { href: "/app/entities", label: "Entities", icon: Network },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
                "group flex h-8 items-center gap-2.5 rounded-sm px-2 text-[13px] font-medium transition-colors",
                active ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className={cn("size-4", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.count ? <span className="font-mono text-2xs text-fg-subtle tabular">{item.count()}</span> : null}
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
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-sm border border-border px-2 py-1.5 text-left hover:bg-surface-2">
        <span className="flex size-7 items-center justify-center rounded-xs bg-accent-soft font-mono text-[11px] font-semibold text-accent">TF</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-fg">{workspace.name}</span>
          <span className="block truncate text-[11px] text-fg-subtle">{workspace.org}</span>
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
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm p-1 pr-2 hover:bg-surface-2" aria-label="Open profile menu">
        <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 font-mono text-[11px] font-medium text-fg">{me.initials}</span>
        <span className="hidden text-left md:block">
          <span className="block text-[12.5px] font-medium leading-tight text-fg">{me.name}</span>
          <span className="block text-[11px] leading-tight text-fg-subtle">Demo persona</span>
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setMobileOpen(false), [pathname]);

  // Dialogs, menus, tooltips and toasts portal to <body>, outside this subtree.
  // Put the ink theme on <body> while the workspace is mounted so they match.
  React.useEffect(() => {
    document.body.classList.add("theme-ink");
    return () => document.body.classList.remove("theme-ink");
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
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="flex items-center justify-between px-1">
        <Link href="/app" className="text-fg" aria-label="Workspace overview">
          <Logo />
        </Link>
        <button className="rounded-xs p-1 text-fg-muted hover:text-fg lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="size-4" />
        </button>
      </div>
      <WorkspaceSwitcher />
      <nav aria-label="Workspace">
        <p className="eyebrow mb-2 px-2">Workspace</p>
        <NavLinks onNavigate={() => setMobileOpen(false)} />
      </nav>
      <div className="mt-auto grid gap-3 border-t border-border px-1 pt-4">
        <p className="text-[11.5px] leading-relaxed text-fg-subtle">{workspace.dataNotice}</p>
        <Link href="/" className="text-[12px] text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Back to the website
        </Link>
      </div>
    </div>
  );

  return (
    <div className="theme-ink min-h-dvh bg-bg text-fg">
      <div className="border-b border-border bg-accent-soft/60 px-4 py-1.5 text-center text-[12px] text-fg-muted">
        <span className="font-medium text-accent">Demo workspace.</span> Every record is fictional and actions are simulated. Nothing you do here is saved.
      </div>
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">{sidebar}</aside>

        {/* Mobile sidebar */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-black/50" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface">{sidebar}</aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-bg/80 lg:px-6">
            <button className="rounded-xs p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <Link href="/app" className="text-fg lg:hidden" aria-label="Workspace overview">
              <Logo showName={false} />
            </Link>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-full max-w-sm items-center gap-2 rounded-sm border border-border bg-surface px-2.5 text-[13px] text-fg-subtle hover:border-border-strong"
            >
              <Search className="size-4" aria-hidden />
              <span className="flex-1 truncate text-left">Search cases, entities, invoices</span>
              <kbd className="hidden rounded-xs border border-border px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
            </button>
            <div className="ml-auto">
              <ProfileMenu />
            </div>
          </header>
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
