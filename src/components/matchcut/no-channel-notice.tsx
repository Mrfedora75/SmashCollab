import { useEffect, useRef } from "react";
import { NO_CHANNEL_TITLE, ytErrorMessage } from "@/components/matchcut/onboarding-helpers";

/**
 * Full-screen message for `/?yt=error&reason=no_channel`.
 * Google sign-in succeeded, but that account has no YouTube channel.
 * Rendered on top of the public landing page so the screen is never blank.
 */
export function NoYouTubeChannelNotice() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-channel-title"
        className="w-full max-w-md rounded-card bg-cream p-6 text-ink-text shadow-card"
      >
        <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">Smash Collab</p>
        <h1
          id="no-channel-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 font-display text-3xl leading-tight outline-none"
        >
          {NO_CHANNEL_TITLE}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-strong">{ytErrorMessage("no_channel")}</p>
        <a
          href="/api/youtube/start"
          className="press mt-6 flex h-12 items-center justify-center rounded-control bg-accent text-sm font-medium text-on-accent"
        >
          Try a different account
        </a>
        <a
          href="https://www.youtube.com/create_channel"
          target="_blank"
          rel="noreferrer"
          className="press mt-2 flex h-12 items-center justify-center rounded-control border border-cream-deep text-sm font-medium"
        >
          Create a YouTube channel
        </a>
        <a href="/" className="mt-4 block text-center text-sm text-muted-strong underline underline-offset-2">
          Back to Smash Collab
        </a>
      </div>
    </div>
  );
}
