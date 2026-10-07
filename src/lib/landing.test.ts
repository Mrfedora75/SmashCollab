import { describe, expect, it } from "vitest";
import { SESSION_HINT_SCRIPT, showLanding, wantsAppFromSearch } from "@/lib/landing";
import { SESSION_KEY } from "@/components/matchcut/onboarding-storage";

describe("showLanding", () => {
  it("shows the landing page to signed-out visitors", () => {
    expect(showLanding({ signedIn: false, hasProfile: false, entered: false })).toBe(true);
  });

  it("never shows it to signed-in creators", () => {
    expect(showLanding({ signedIn: true, hasProfile: true, entered: false })).toBe(false);
    expect(showLanding({ signedIn: true, hasProfile: true, entered: true })).toBe(false);
  });

  it("hides it once a visitor taps Get started / Sign in", () => {
    expect(showLanding({ signedIn: false, hasProfile: false, entered: true })).toBe(false);
  });
});

describe("wantsAppFromSearch", () => {
  it("goes straight into the app after a YouTube or Stripe redirect, or ?start", () => {
    expect(wantsAppFromSearch("?yt=ok")).toBe(true);
    expect(wantsAppFromSearch("?yt=error&reason=denied")).toBe(true);
    expect(wantsAppFromSearch("?checkout=success&session_id=cs_test")).toBe(true);
    expect(wantsAppFromSearch("?start=1")).toBe(true);
  });

  it("keeps plain visits and invite links on the landing page", () => {
    expect(wantsAppFromSearch("")).toBe(false);
    expect(wantsAppFromSearch("?ref=abc123")).toBe(false);
  });
});

describe("SESSION_HINT_SCRIPT", () => {
  it("reads the same session key as the app", () => {
    expect(SESSION_HINT_SCRIPT).toContain(JSON.stringify(SESSION_KEY));
    expect(SESSION_HINT_SCRIPT).toContain('"matchcut-profile"');
  });

  it("is valid JavaScript", () => {
    expect(() => new Function(SESSION_HINT_SCRIPT)).not.toThrow();
  });
});
