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

export function wantsAppFromSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  return ENTRY_PARAMS.some((key) => params.has(key));
}

export function showLanding(input: { signedIn: boolean; hasProfile: boolean; entered: boolean }): boolean {
  if (input.signedIn && input.hasProfile) return false;
  return !input.entered;
}

/** localStorage keys read by the pre-hydration script (same keys as onboarding-storage). */
export const SESSION_KEY = "matchcut-signed-in";
export const PROFILE_KEY = "matchcut-profile";

/**
 * Tiny inline script for <head>: marks <html data-session="1"> before React loads when
 * this browser probably has a signed-in creator (or is mid sign-in), so the landing page
 * does not flash for them. The app removes the attribute as soon as it has hydrated.
 */
export const SESSION_HINT_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(SESSION_KEY)}),p=localStorage.getItem(${JSON.stringify(
  PROFILE_KEY,
)});if((s!=="0"&&p)||/[?&](${ENTRY_PARAMS.join("|")})=/.test(location.search))document.documentElement.setAttribute("data-session","1")}catch(e){}`;
