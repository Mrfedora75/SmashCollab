import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import type { Plain, TransactionContext, Write } from "@/lib/server/firestore.server";

// ---- in-memory stand-in for the service-account Firestore client ----------
const store = new Map<string, Record<string, Plain>>();

function applyWrites(writes: Write[]) {
  for (const w of writes) {
    const exists = store.has(w.path);
    if (w.precondition === "absent" && exists) throw new Error("precondition");
    if (w.precondition === "exists" && !exists) throw new Error("precondition");
  }
  for (const w of writes) {
    const doc = { ...(store.get(w.path) ?? {}), ...w.fields };
    for (const [k, by] of Object.entries(w.increment ?? {})) doc[k] = (typeof doc[k] === "number" ? (doc[k] as number) : 0) + by;
    for (const [k, v] of Object.entries(w.maximum ?? {})) doc[k] = Math.max(typeof doc[k] === "number" ? (doc[k] as number) : 0, v);
    for (const k of w.serverTime ?? []) doc[k] = Date.now();
    store.set(w.path, doc);
  }
}

vi.mock("@/lib/server/firestore.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/firestore.server")>();
  return {
    ...actual,
    isStorageConfigured: () => true,
    firebaseProjectId: () => "demo-smash",
    getDocument: async (path: string) => (store.has(path) ? { ...store.get(path)! } : null),
    commit: async (writes: Write[]) => applyWrites(writes),
    runTransaction: async <T,>(body: (tx: TransactionContext) => Promise<{ writes: Write[]; result: T }>) => {
      const planned = await body({ get: async (path) => (store.has(path) ? { ...store.get(path)! } : null) });
      applyWrites(planned.writes);
      return planned.result;
    },
  };
});

const { decidePitch } = await import("@/lib/pitch-policy");
const { handlePitchRequest } = await import("@/lib/server/pitch.server");
const { setFirebaseKeysForTests } = await import("@/lib/server/firebase-auth.server");
const { bindProfileToChannel, ProfileBindError } = await import("@/lib/server/public-profile.server");

let privateKey: CryptoKey;
let attackerKey: CryptoKey;

async function tokenFor(uid: string, key: CryptoKey = privateKey, email = `${uid}@example.com`) {
  return new SignJWT({ email, email_verified: true, auth_time: Math.floor(Date.now() / 1000) })
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer("https://securetoken.google.com/demo-smash")
    .setAudience("demo-smash")
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

async function pitch(from: string, to: string, opts: { key?: CryptoKey; auth?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) headers.Authorization = `Bearer ${await tokenFor(from, opts.key)}`;
  const res = await handlePitchRequest(
    new Request("http://localhost/api/pitch", { method: "POST", headers, body: JSON.stringify({ to, note: "Collab?" }) }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function profile(uid: string, extra: Record<string, Plain> = {}) {
  store.set(`users/${uid}`, { uid, channel: `@${uid}`, avgViews: 1, niches: ["Gaming"], ...extra });
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  attackerKey = (await generateKeyPair("RS256")).privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "test-kid", alg: "RS256", use: "sig" };
  setFirebaseKeysForTests(createLocalJWKSet({ keys: [jwk] }));
});
afterAll(() => setFirebaseKeysForTests(null));

beforeEach(() => {
  store.clear();
  process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
  delete process.env.PLUS_COMP_EMAILS;
  delete process.env.PLUS_COMP_CHANNEL_IDS;
  // Sender "free" is linked to channel UCfree; targets have server-written subscriber counts.
  profile("free", { verifiedChannelId: "UCfree" });
  store.set("channels/UCfree", { channelId: "UCfree", uid: "free" });
  profile("small", { subscriberCount: 1200 });
  profile("big", { subscriberCount: 250_000 });
  profile("edge", { subscriberCount: 5_000 });
  profile("spoofed", { subscribers: 10 }); // browser-written legacy field only, never verified
});

describe("pitch policy", () => {
  it("keeps the existing limits: 4 free pitches a day, only to channels under 5,000", () => {
    expect(decidePitch({ plus: false, targetSubscribers: 4_999, freeUsedToday: 0, credits: 0 })).toEqual({ allowed: true, useCredit: false, countsAsFree: true });
    expect(decidePitch({ plus: false, targetSubscribers: 5_000, freeUsedToday: 0, credits: 0 })).toEqual({ allowed: false, code: "over_limit" });
    expect(decidePitch({ plus: false, targetSubscribers: 10, freeUsedToday: 4, credits: 0 })).toEqual({ allowed: false, code: "daily_limit" });
    expect(decidePitch({ plus: false, targetSubscribers: null, freeUsedToday: 0, credits: 0 })).toEqual({ allowed: false, code: "target_unverified" });
    expect(decidePitch({ plus: false, targetSubscribers: 9e6, freeUsedToday: 9, credits: 1 })).toEqual({ allowed: true, useCredit: true, countsAsFree: false });
    expect(decidePitch({ plus: true, targetSubscribers: 9e6, freeUsedToday: 99, credits: 0 })).toEqual({ allowed: true, useCredit: false, countsAsFree: false });
  });
});

describe("POST /api/pitch", () => {
  it("requires a valid Firebase ID token", async () => {
    expect((await pitch("free", "small", { auth: false })).status).toBe(401);
    expect((await pitch("free", "small", { key: attackerKey })).status).toBe(401);
    expect(store.has("swipes/free_small")).toBe(false);
  });

  it("refuses over-5K targets for free users without a credit", async () => {
    for (const target of ["big", "edge"]) {
      const res = await pitch("free", target);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("over_limit");
      expect(String(res.body.error)).toContain("upgrade to Plus or use a $1 pitch");
      expect(store.has(`swipes/free_${target}`)).toBe(false);
    }
  });

  it("ignores the browser-written subscriber field (unverified targets are refused for free users)", async () => {
    const res = await pitch("free", "spoofed");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("target_unverified");
  });

  it("spends one $1 pitch credit for an over-5K target", async () => {
    store.set("entitlements/UCfree", { channelId: "UCfree", pitchCredits: 1 });
    const res = await pitch("free", "big");
    expect(res.status).toBe(200);
    expect(res.body.usedCredit).toBe(true);
    expect(store.get("entitlements/UCfree")?.pitchCredits).toBe(0);
    expect(store.get("swipes/free_big")?.direction).toBe("pitch");
    expect((await pitch("free", "edge")).status).toBe(403);
  });

  it("enforces the daily free-pitch limit with a server-side counter", async () => {
    for (let i = 0; i < 4; i += 1) profile(`s${i}`, { subscriberCount: 100 });
    profile("s4", { subscriberCount: 100 });
    for (let i = 0; i < 4; i += 1) expect((await pitch("free", `s${i}`)).status).toBe(200);
    expect(store.get("pitchUsage/free")?.count).toBe(4);
    const fifth = await pitch("free", "s4");
    expect(fifth.status).toBe(429);
    expect(fifth.body.code).toBe("daily_limit");
    // Re-sending an existing pitch is not charged again.
    expect((await pitch("free", "s0")).body.already).toBe(true);
    // Deleting a pitch (client side) does not give the free pitch back.
    store.delete("swipes/free_s0");
    expect((await pitch("free", "s0")).status).toBe(429);
  });

  it("lets Plus members pitch any channel without limits", async () => {
    store.set("entitlements/UCfree", { channelId: "UCfree", plusUntil: Date.now() + 86_400_000 });
    expect((await pitch("free", "big")).status).toBe(200);
    expect((await pitch("free", "spoofed")).status).toBe(200);
    expect(store.get("pitchUsage/free")?.count).toBe(0);
  });

  it("creates the match on the server when both creators pitched", async () => {
    profile("small2", { subscriberCount: 100, verifiedChannelId: "UCs2" });
    profile("free2", { subscriberCount: 100 });
    store.set("swipes/free2_small2", { from: "free2", to: "small2", direction: "pitch", note: "" });
    const res = await pitch("small2", "free2");
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(store.get("matches/free2_small2")?.users).toEqual(["free2", "small2"]);
  });

  it("rejects pitching yourself or a missing creator", async () => {
    expect((await pitch("free", "free")).status).toBe(400);
    expect((await pitch("free", "nobody")).status).toBe(404);
  });
});

describe("profile binding", () => {
  it("refuses to link a YouTube channel verified with a different Google account", async () => {
    await expect(
      bindProfileToChannel({ uid: "free", email: "a@example.com", emailVerified: true }, { channelId: "UCx", channel: "@x", email: "b@example.com" }),
    ).rejects.toBeInstanceOf(ProfileBindError);
  });

  it("writes the YouTube-verified subscriber count and Plus flag onto the profile", async () => {
    store.set("channels/UCnew", { channelId: "UCnew", subscriberCount: 7_777 });
    store.set("entitlements/UCnew", { channelId: "UCnew", plusUntil: Date.now() + 60_000 });
    profile("newbie", { subscribers: 1 });
    await bindProfileToChannel({ uid: "newbie", email: null, emailVerified: false }, { channelId: "UCnew", channel: "@new", email: null });
    const doc = store.get("users/newbie")!;
    expect(doc.subscriberCount).toBe(7_777);
    expect(doc.subscribers).toBe(7_777);
    expect(doc.plus).toBe(true);
    expect(doc.verifiedChannelId).toBe("UCnew");
    expect(store.get("channels/UCnew")?.uid).toBe("newbie");
  });
});
