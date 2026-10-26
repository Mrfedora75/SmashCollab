export const NO_CHANNEL_TITLE = "You need a YouTube channel to use Smash Collab";

export function ytErrorMessage(reason: string | null): string {
  switch (reason) {
    case "config":
      return "YouTube verification isn’t configured yet.";
    case "denied":
      return "Google sign-in was cancelled or denied. Try again when you’re ready.";
    case "state":
      return "That sign-in link expired or was invalid. Please try Verify via YouTube again.";
    case "token":
      return "We couldn’t finish Google sign-in. Please try again.";
    case "no_channel":
      return "The Google account you signed in with doesn't have a YouTube channel. Create one on YouTube, or try a different Google account.";
    case "api":
      return "We couldn’t load your YouTube channel just now. Your Google sign-in is saved, so you can try again without another Google prompt.";
    case "retry":
      return "That channel check expired. Please sign in with Google again.";
    default:
      return "YouTube verification failed. Please try again.";
  }
}

/** The access token is still saved, so this failure can be retried without Google consent. */
export function canRetryChannelFetch(reason: string | null): boolean {
  // no_channel will not succeed by calling YouTube again with the same Google account.
  return reason === "api";
}

export function clearYtQueryParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("yt") && !url.searchParams.has("reason")) return;
  url.searchParams.delete("yt");
  url.searchParams.delete("reason");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
