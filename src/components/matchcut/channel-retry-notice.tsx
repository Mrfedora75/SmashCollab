import { canRetryChannelFetch, ytErrorMessage } from "@/components/matchcut/onboarding-helpers";
import { cn } from "@/lib/cn";

/** Shown when YouTube channel lookup failed but the Google sign-in is still saved. */
export function ChannelRetryNotice({
  reason,
  tone = "light",
}: {
  reason: string | null;
  tone?: "light" | "dark";
}) {
  if (!canRetryChannelFetch(reason)) return null;
  const dark = tone === "dark";
  return (
    <div
      role="alert"
      className={cn(
        "rounded-control px-3 py-3 text-left text-sm",
        dark ? "border border-line bg-ink-soft text-cream" : "border border-cream-deep bg-cream-deep/60 text-ink-text",
      )}
    >
      <p>{ytErrorMessage(reason)}</p>
      <a
        href="/api/youtube/retry"
        className="press mt-3 flex h-11 items-center justify-center rounded-control bg-accent text-sm font-medium text-on-accent"
      >
        Try again
      </a>
    </div>
  );
}
