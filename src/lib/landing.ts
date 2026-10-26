/**
 * When to show the public marketing landing page at "/".
 *
 * Signed-out visitors see the landing page first. They go into the app (age check,
 * terms, then Create Profile / sign in) only after tapping "Get started" / "Sign in",
 * or when the URL says they are coming back from a sign-in or checkout redirect.
 * Signed-in creators never see the landing page.
 */

/** Query params that mean "this visitor is mid-flow, take them straight into the app". */
const ENTRY_PARAMS = ["yt", "checkout", "start"] as const;

/** Google sign-in worked, but that account has no YouTube channel. Stay on a visible page. */
export function isNoChannelSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("yt") === "error" && params.get("reason") === "no_channel";
}

export function wantsAppFromSearch(search: string): boolean {
  if (isNoChannelSearch(search)) return false;
  const params = new URLSearchParams(search);
  return ENTRY_PARAMS.some((key) => params.has(key));
}

export function showLanding(input: {
  signedIn: boolean;
  hasProfile: boolean;
  entered: boolean;
  noChannel?: boolean;
}): boolean {
  // A missing channel must not drop the visitor into the blurred, locked app.
  if (input.noChannel) return true;
  if (input.signedIn && input.hasProfile) return false;
  return !input.entered;
}

/** localStorage keys read by the pre-hydration script (same keys as onboarding-storage). */
export const SESSION_KEY = "matchcut-signed-in";
export const PROFILE_KEY = "matchcut-profile";

/**
 * Hides the landing before paint for a signed-in return (`yt=ok`, checkout, or start).
 * `yt=error` is excluded on purpose: hiding the only page content is a blank screen,
 * which is what a Google account with no YouTube channel used to land on.
 */
export const HIDE_LANDING_SEARCH = /[?&](?:checkout|start)=|[?&]yt=ok(?:&|$)/;

/**
 * Tiny inline script for <head>: marks <html data-session="1"> before React loads when
 * this browser probably has a signed-in creator (or is mid sign-in), so the landing page
 * does not flash for them. The app removes the attribute as soon as it has hydrated.
 */
export const SESSION_HINT_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(SESSION_KEY)}),p=localStorage.getItem(${JSON.stringify(
  PROFILE_KEY,
)});if((s!=="0"&&p)||${HIDE_LANDING_SEARCH.toString()}.test(location.search))document.documentElement.setAttribute("data-session","1")}catch(e){}`;
