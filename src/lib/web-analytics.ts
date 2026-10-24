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
