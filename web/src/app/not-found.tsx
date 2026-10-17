import Link from "next/link";
import { Logo } from "@/components/domain/logo";

export default function NotFound() {
  return (
    <main className="theme-paper flex min-h-dvh flex-col items-start justify-center gap-6 bg-bg px-6 py-16 sm:px-16">
      <Logo />
      <p className="eyebrow">404 · Not found</p>
      <h1 className="max-w-xl font-serif text-5xl leading-[1.05] tracking-tight">This page isn&rsquo;t part of the record.</h1>
      <p className="max-w-md text-fg-muted">The link may be out of date. Start again from the homepage or go straight to the demo workspace.</p>
      <div className="flex gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-sm bg-fg px-4 text-sm font-medium text-bg">Homepage</Link>
        <Link href="/app" className="inline-flex h-10 items-center rounded-sm border border-border-strong px-4 text-sm font-medium">Demo workspace</Link>
      </div>
    </main>
  );
}
