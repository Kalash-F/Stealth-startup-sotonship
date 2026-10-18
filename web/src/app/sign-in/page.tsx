import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/domain/logo";
import { PriorityBadge } from "@/components/domain/status";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analystById, demoUserId } from "@/data/reference";
import { attentionQueue } from "@/data/workspace";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  const persona = analystById(demoUserId);
  const queue = attentionQueue().slice(0, 3);

  return (
    <main className="theme-paper flex min-h-dvh flex-col bg-bg text-fg md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="sign-in-heading" className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex w-fit text-fg">
            <Logo />
          </Link>

          <p className="eyebrow mt-12">Demo access</p>
          <h1 id="sign-in-heading" className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
            Sign in
          </h1>

          <SignInForm />

          <div className="mt-10 border-t border-border pt-8">
            <h2 className="text-[15px] font-semibold tracking-tight">Explore the demo</h2>
            <p className="mt-1 text-[13px] text-fg-muted">
              Opens a sample workspace with fictional data, as {persona?.name ?? "a sample analyst"}
              {persona ? `, ${persona.role}` : ""}.
            </p>
            <Link href="/app" className={cn(buttonVariants({ variant: "accent", size: "lg" }), "mt-4 w-full")}>
              Explore the workspace
            </Link>
          </div>

          <nav aria-label="Other pages" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <Link href="/request-demo" className="text-fg underline-offset-4 hover:underline">
              Request a demo
            </Link>
            <Link href="/" className="text-fg underline-offset-4 hover:underline">
              Back to the website
            </Link>
          </nav>
        </div>
      </section>

      <aside
        aria-label="Product preview"
        className="theme-ink hidden flex-col justify-center border-l border-border bg-bg px-12 py-16 md:flex lg:px-16"
      >
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between gap-4">
            <h2 className="eyebrow">Attention queue</h2>
            <SyntheticBadge />
          </div>
          <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
            {queue.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-fg-subtle">{item.id}</p>
                  <p className="text-[13px] text-fg">{item.title}</p>
                </div>
                <PriorityBadge band={item.priority_band} score={item.priority_score} className="self-start sm:self-center" />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-fg-muted">Three open cases from the sample workspace, highest priority first.</p>
        </div>
      </aside>
    </main>
  );
}
