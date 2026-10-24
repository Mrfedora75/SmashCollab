import { describe, expect, it } from "vitest";
import { ANALYTICS_PRIVACY_SENTENCE, redactAnalyticsEvent } from "@/lib/web-analytics";
import { CONTENT_SECURITY_POLICY } from "@/lib/security-headers";

describe("redactAnalyticsEvent", () => {
  it("drops query strings and hashes that can carry session or referral ids", () => {
    expect(
      redactAnalyticsEvent({
        type: "pageview",
        url: "https://smashcollab.com/?checkout=success&session_id=cs_test_123",
      }),
    ).toEqual({ type: "pageview", url: "https://smashcollab.com/" });

    expect(
      redactAnalyticsEvent({
        type: "pageview",
        url: "https://smashcollab.com/pricing?ref=abc123#plans",
      }),
    ).toEqual({ type: "pageview", url: "https://smashcollab.com/pricing" });
  });

  it("keeps the path when the event url is relative", () => {
    expect(redactAnalyticsEvent({ type: "pageview", url: "/privacy?ref=abc" })).toEqual({
      type: "pageview",
      url: "https://smashcollab.com/privacy",
    });
  });

  it("leaves an unparseable url unchanged so the page view is still sent", () => {
    const event = { type: "pageview" as const, url: "http://[" };
    expect(redactAnalyticsEvent(event)).toBe(event);
  });
});

describe("analytics privacy copy", () => {
  it("states that visit statistics are anonymous and cookie-less", () => {
    expect(ANALYTICS_PRIVACY_SENTENCE).toBe(
      "Anonymous, cookie-less visit statistics are collected via Vercel Web Analytics.",
    );
  });
});

describe("content security policy", () => {
  it("allows first-party /_vercel/insights via 'self' and no other analytics hosts", () => {
    expect(directive(CONTENT_SECURITY_POLICY, "script-src")).toContain("'self'");
    expect(directive(CONTENT_SECURITY_POLICY, "connect-src")).toContain("'self'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("va.vercel-scripts.com");
    expect(CONTENT_SECURITY_POLICY).not.toContain("vercel-insights.com");
    expect(CONTENT_SECURITY_POLICY).not.toContain("vercel-analytics.com");
    expect(externalSources(CONTENT_SECURITY_POLICY)).toEqual([
      "https://apis.google.com",
      "https://accounts.google.com",
      "https://www.gstatic.com",
      "https://js.stripe.com",
      "https://fonts.googleapis.com",
      "https://accounts.google.com",
      "https://fonts.gstatic.com",
      "https://*.googleapis.com",
      "https://*.firebaseio.com",
      "wss://*.firebaseio.com",
      "https://*.firebaseapp.com",
      "https://accounts.google.com",
      "https://api.stripe.com",
      "https://*.firebaseapp.com",
      "https://accounts.google.com",
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://checkout.stripe.com",
      "https://checkout.stripe.com",
      "https://accounts.google.com",
    ]);
  });
});

function directive(policy: string, name: string): string {
  const match = policy.split("; ").find((part) => part.startsWith(`${name} `));
  if (!match) throw new Error(`missing ${name}`);
  return match;
}

function externalSources(policy: string): string[] {
  return [...policy.matchAll(/(?:https|wss):\/\/[^\s;]+/g)].map((match) => match[0]);
}
