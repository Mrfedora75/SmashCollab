import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { liveModeBlocked, stripeMode, verifyStripeSignature, subscriptionPeriodEnd } from "@/lib/stripe-billing.server";
import { isCompAccount, readPlusEntitlement, signPlusEntitlement } from "@/lib/youtube/plus-entitlement";

const saved = { ...process.env };
beforeEach(() => {
  process.env = { ...saved, GOOGLE_CLIENT_SECRET: "test-google-secret" };
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
});
afterEach(() => {
  process.env = { ...saved };
});

describe("Stripe safety", () => {
  it("detects test vs live from the key prefix only", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(stripeMode()).toBe("test");
    expect(liveModeBlocked()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    expect(stripeMode()).toBe("live");
    expect(liveModeBlocked()).toBe(true);
    process.env.STRIPE_ALLOW_LIVE = "true";
    expect(liveModeBlocked()).toBe(false);
  });

  it("accepts only correctly signed, fresh webhook payloads", () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret)).toBe(true);
    expect(verifyStripeSignature(payload + " ", `t=${t},v1=${sig}`, secret)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${t},v1=${sig}`, "whsec_other")).toBe(false);
    const old = t - 3600;
    const oldSig = createHmac("sha256", secret).update(`${old}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${old},v1=${oldSig}`, secret)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret)).toBe(false);
  });

  it("reads the subscription period end from old and new API shapes", () => {
    expect(subscriptionPeriodEnd({ current_period_end: 100 })).toBe(100_000);
    expect(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 200 }] } })).toBe(200_000);
    expect(subscriptionPeriodEnd({})).toBeNull();
  });
});

describe("Plus cookie", () => {
  it("round-trips a cookie signed with PLUS_COOKIE_SECRET", async () => {
    process.env.PLUS_COOKIE_SECRET = "plus-secret";
    const token = await signPlusEntitlement({ channelId: "UC1", premiumUntil: Date.now() + 60_000, source: "stripe" });
    expect((await readPlusEntitlement(token))?.channelId).toBe("UC1");
  });

  it("still accepts cookies signed with the old key (temporary fallback)", async () => {
    const token = await signPlusEntitlement({ channelId: "UC1", premiumUntil: Date.now() + 60_000, source: "stripe" });
    process.env.PLUS_COOKIE_SECRET = "plus-secret";
    expect((await readPlusEntitlement(token))?.channelId).toBe("UC1");
  });

  it("rejects cookies minted by the old free grant route (no trusted source)", async () => {
    const legacy = await new SignJWT({ channelId: "UC1", premiumUntil: Date.now() + 60_000, source: null })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("test-google-secret"));
    expect(await readPlusEntitlement(legacy)).toBeNull();
  });

  it("rejects forged cookies", async () => {
    const forged = await new SignJWT({ channelId: "UC1", premiumUntil: Date.now() + 60_000, source: "stripe" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("attacker"));
    expect(await readPlusEntitlement(forged)).toBeNull();
  });
});

describe("Tester comp allowlist", () => {
  it("matches only allowlisted verified emails or channel IDs", () => {
    process.env.PLUS_COMP_EMAILS = "Tester@Example.com, other@example.com";
    process.env.PLUS_COMP_CHANNEL_IDS = "UCcomp";
    expect(isCompAccount({ channelId: "UCx", channel: null, email: "tester@example.com" })).toBe(true);
    expect(isCompAccount({ channelId: "UCcomp", channel: null, email: null })).toBe(true);
    expect(isCompAccount({ channelId: "UCx", channel: null, email: "nobody@example.com" })).toBe(false);
    expect(isCompAccount({ channelId: "UCx", channel: null, email: null })).toBe(false);
  });

  it("grants nothing when the allowlist is unset", () => {
    delete process.env.PLUS_COMP_EMAILS;
    delete process.env.PLUS_COMP_CHANNEL_IDS;
    expect(isCompAccount({ channelId: "UCx", channel: null, email: "tester@example.com" })).toBe(false);
  });
});
