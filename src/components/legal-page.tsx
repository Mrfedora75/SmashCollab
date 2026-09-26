import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/matchcut/mark";
import { SiteFooter } from "@/components/site-footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <Mark className="size-8 shrink-0 text-cream" />
            <span className="font-display text-2xl leading-none">Smash Collab</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-display text-4xl leading-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="legal mt-6 flex flex-col gap-4 text-sm leading-relaxed text-cream">{children}</div>
        <p className="mt-10">
          <Link to="/" className="press text-sm underline underline-offset-2">
            Back to Smash Collab
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 font-display text-2xl leading-tight">{children}</h2>;
}
