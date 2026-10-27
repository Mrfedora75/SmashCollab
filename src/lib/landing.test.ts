import { describe, expect, it } from "vitest";
import { HIDE_LANDING_SEARCH, SESSION_HINT_SCRIPT, isNoChannelSearch, showLanding, wantsAppFromSearch } from "@/lib/landing";
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

  it("stays on the landing page when Google has no YouTube channel", () => {
    expect(showLanding({ signedIn: false, hasProfile: false, entered: true, noChannel: true })).toBe(true);
    expect(showLanding({ signedIn: true, hasProfile: true, entered: true, noChannel: true })).toBe(true);
  });
});

describe("wantsAppFromSearch", () => {
  it("goes straight into the app after a YouTube or Stripe redirect, or ?start", () => {
    expect(wantsAppFromSearch("?yt=ok")).toBe(true);
    expect(wantsAppFromSearch("?yt=error&reason=denied")).toBe(true);
    expect(wantsAppFromSearch("?checkout=success&session_id=cs_test")).toBe(true);
    expect(wantsAppFromSearch("?start=1")).toBe(true);
  });

  it("does not enter the locked app when the Google account has no channel", () => {
    expect(isNoChannelSearch("?yt=error&reason=no_channel")).toBe(true);
    expect(wantsAppFromSearch("?yt=error&reason=no_channel")).toBe(false);
    expect(wantsAppFromSearch("?yt=error&reason=api")).toBe(true);
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

  it("does not hide the page for a YouTube error redirect", () => {
    expect(HIDE_LANDING_SEARCH.test("?yt=error&reason=no_channel")).toBe(false);
    expect(HIDE_LANDING_SEARCH.test("?yt=error&reason=denied")).toBe(false);
    expect(HIDE_LANDING_SEARCH.test("?yt=ok")).toBe(true);
    expect(HIDE_LANDING_SEARCH.test("?checkout=success&session_id=cs_test")).toBe(true);
    expect(HIDE_LANDING_SEARCH.test("?start=1")).toBe(true);
    expect(SESSION_HINT_SCRIPT).toContain(HIDE_LANDING_SEARCH.toString());
  });
});
