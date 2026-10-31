import type { BeforeSendEvent } from "@vercel/analytics/react";

export const ANALYTICS_PRIVACY_SENTENCE =
  "Anonymous, cookie-less visit statistics are collected via Vercel Web Analytics.";

/**
 * Keep page views path-only. Smash Collab puts Stripe checkout session ids and referral codes in the query string.
 */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  try {
    const url = new URL(event.url, "https://smashcollab.com");
    url.search = "";
    url.hash = "";
    return { type: event.type, url: url.toString() };
  } catch {
    return event;
  }
}

export const ANALYTICS_DISABLE_KEY = "va-disable";

/** True when this browser opted out of analytics (owner's own visits). SSR-safe. */
export function isAnalyticsDisabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(ANALYTICS_DISABLE_KEY) != null;
  } catch {
    return false;
  }
}

/**
 * `?owner=1` opts this browser out of analytics, `?owner=0` opts back in. The param is then removed from the address bar.
 * Not tied to sign-in. Safe to call repeatedly and during SSR.
 */
export function applyOwnerParam(): void {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const value = url.searchParams.get("owner");
    if (value === null) return;
    if (value === "1") window.localStorage.setItem(ANALYTICS_DISABLE_KEY, "1");
    else if (value === "0") window.localStorage.removeItem(ANALYTICS_DISABLE_KEY);
    url.searchParams.delete("owner");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    // Storage or history unavailable (private mode, SSR); ignore.
  }
}

/** beforeSend: drop events from opted-out browsers, otherwise redact as usual. */
export function analyticsBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  applyOwnerParam();
  if (isAnalyticsDisabled()) return null;
  return redactAnalyticsEvent(event);
}
