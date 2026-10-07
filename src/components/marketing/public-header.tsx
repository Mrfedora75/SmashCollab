import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/matchcut/mark";

/** "/?start=1" opens the sign-in flow straight away (see lib/landing.ts). */
export const START_HREF = "/?start=1";

/**
 * Header for the public pages (landing, pricing, info). One Sign in button only.
 * On the landing page `onStart` opens the sign-in flow in place; elsewhere it links home.
 */
export function PublicHeader({ onStart }: { onStart?: () => void }) {
  const signInClass =
    "press inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-control bg-accent px-3 text-sm sm:px-4 font-medium text-on-accent";
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Smash Collab home">
          <Mark className="size-8 shrink-0 text-cream sm:size-9" />
          <span className="whitespace-nowrap font-display text-xl leading-none min-[400px]:text-2xl sm:text-[1.75rem]">Smash Collab</span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 sm:gap-2">
          <a href="/#how-it-works" className="hidden rounded-control px-3 py-2 text-sm text-cream/85 hover:text-cream md:inline-block">
            How it works
          </a>
          <Link to="/pricing" className="rounded-control px-1.5 py-2 text-sm text-cream/85 hover:text-cream sm:px-3">
            Pricing
          </Link>
          <Link to="/info" className="hidden rounded-control px-1.5 py-2 text-sm min-[375px]:inline-block text-cream/85 hover:text-cream sm:px-3">
            Info
          </Link>
          {onStart ? (
            <button type="button" onClick={onStart} className={signInClass}>
              Sign in
            </button>
          ) : (
            <a href={START_HREF} className={signInClass}>
              Sign in
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Primary call to action used on every public page. */
export function StartButton({ onStart, children, className = "" }: { onStart?: () => void; children: ReactNode; className?: string }) {
  const cls = `press inline-flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-base font-medium text-on-accent ${className}`;
  return onStart ? (
    <button type="button" onClick={onStart} className={cls}>
      {children}
    </button>
  ) : (
    <a href={START_HREF} className={cls}>
      {children}
    </a>
  );
}
