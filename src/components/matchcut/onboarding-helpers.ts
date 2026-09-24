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
      return "This Google account doesn’t have a YouTube channel. Create one, then verify again.";
    case "api":
      return "YouTube didn’t return channel stats. Please try again in a moment.";
    default:
      return "YouTube verification failed. Please try again.";
  }
}

export function clearYtQueryParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("yt") && !url.searchParams.has("reason")) return;
  url.searchParams.delete("yt");
  url.searchParams.delete("reason");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
