import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import type { Plain, Write } from "@/lib/server/firestore.server";

// ---- in-memory stand-in for the service-account Firestore client ----------
const store = new Map<string, Record<string, Plain>>();
let storageOn = true;
const savedEnv = { ...process.env };
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

vi.mock("@/lib/server/firestore.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/firestore.server")>();
  return {
    ...actual,
    isStorageConfigured: () => storageOn,
    firebaseProjectId: () => "demo-smash",
    getDocument: async (path: string) => (store.has(path) ? { ...store.get(path)! } : null),
    commit: async (writes: Write[]) => {
      for (const w of writes) {
        if (w.precondition === "exists" && !store.has(w.path)) throw new Error("precondition");
        store.set(w.path, { ...(store.get(w.path) ?? {}), ...w.fields });
      }
    },
  };
});

const { handleRestoreRequest, RESTORE_MAX_AUTH_AGE_SEC } = await import("@/lib/server/session-restore.server");
const { resetRateLimitForTests } = await import("@/lib/server/custom-token.server");
const { setFirebaseKeysForTests } = await import("@/lib/server/firebase-auth.server");
const { readPlusEntitlement, readYtAccount } = await import("@/lib/youtube/plus-entitlement");

let privateKey: CryptoKey;
let attackerKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  attackerKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-kid", alg: "RS256" } as JWK;
  setFirebaseKeysForTests(createLocalJWKSet({ keys: [jwk] }));
});

afterAll(() => {
  setFirebaseKeysForTests(null);
  process.env = { ...savedEnv };
});

beforeEach(() => {
  store.clear();
  storageOn = true;
  resetRateLimitForTests();
  delete process.env.PLUS_COMP_EMAILS;
  delete process.env.PLUS_COMP_CHANNEL_IDS;
});

async function idToken(
  uid: string,
  opts: { key?: CryptoKey; email?: string | null; authAgeSec?: number; emailVerified?: boolean; provider?: string } = {},
) {
  return new SignJWT({
    ...(opts.email === null ? {} : { email: opts.email ?? `${uid}@example.com` }),
    email_verified: opts.emailVerified ?? true,
    firebase: { sign_in_provider: opts.provider ?? "google.com" },
    auth_time: Math.floor(Date.now() / 1000) - (opts.authAgeSec ?? 5),
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer("https://securetoken.google.com/demo-smash")
    .setAudience("demo-smash")
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(opts.key ?? privateKey);
}

function link(uid: string, channelId: string, extra: { email?: string | null } = {}) {
  store.set(`users/${uid}`, { uid, channel: "@me", channelId, niches: ["Gaming"], verifiedChannelId: channelId });
  store.set(`channels/${channelId}`, {
    channelId,
    channel: "@me",
    email: extra.email === undefined ? `${uid}@example.com` : extra.email,
    uid,
  });
}

async function post(opts: { token?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const headers: Record<string, string> = { Host: "smashcollab.com", ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await handleRestoreRequest(
    new Request("https://smashcollab.com/api/auth/restore", {
      method: "POST",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
  const cookies = res.headers.getSetCookie();
  const cookie = (name: string) => {
    const hit = cookies.find((c) => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1).split(";")[0]) : undefined;
  };
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, cookies, cookie, cache: res.headers.get("cache-control") };
}

describe("POST /api/auth/restore (Continue as @channel)", () => {
  it("requires a valid Firebase ID token", async () => {
    link("uid-1", "UCme");
    expect((await post()).status).toBe(401);
    expect((await post({ token: "not-a-jwt" })).status).toBe(401);
    const forged = await post({ token: await idToken("uid-1", { key: attackerKey }) });
    expect(forged.status).toBe(401);
    expect(forged.cookies).toEqual([]);
  });

  it("requires a recent Google sign-in (not an old persisted session)", async () => {
    link("uid-1", "UCme");
    const res = await post({ token: await idToken("uid-1", { authAgeSec: RESTORE_MAX_AUTH_AGE_SEC + 60 }) });
    expect(res.status).toBe(401);
    expect(res.cookies).toEqual([]);
  });

  it("restores the verified session and re-issues the signed account cookie", async () => {
    link("uid-1", "UCme");
    const res = await post({ token: await idToken("uid-1") });
    expect(res.status).toBe(200);
    expect(res.cache).toBe("no-store");
    expect(res.body).toMatchObject({ restored: true, channelId: "UCme", channel: "@me", premium: false });
    const account = await readYtAccount(res.cookie("yt_account"));
    expect(account).toEqual({ channelId: "UCme", channel: "@me", email: "uid-1@example.com" });
    expect(res.cookies.find((c) => c.startsWith("yt_account="))).toContain("HttpOnly");
  });

  it("never trusts a channel id sent by the browser", async () => {
    link("uid-1", "UCme");
    link("uid-2", "UCvictim");
    store.set("entitlements/UCvictim", { plusUntil: Date.now() + 86_400_000 });
    const res = await post({
      token: await idToken("uid-1"),
      body: { channelId: "UCvictim", verifiedChannelId: "UCvictim" },
      headers: { "Content-Type": "application/json", Cookie: "yt_channel=UCvictim" },
    });
    expect(res.status).toBe(200);
    expect(res.body.channelId).toBe("UCme");
    expect(res.body.premium).toBe(false);
    expect((await readYtAccount(res.cookie("yt_account")))?.channelId).toBe("UCme");
  });

  it("falls back to full verification when no verified channel is on file", async () => {
    store.set("users/uid-1", { uid: "uid-1", channel: "@me", channelId: "UCme", niches: ["Gaming"] });
    const res = await post({ token: await idToken("uid-1") });
    expect(res.status).toBe(404);
    expect(res.body.needsVerify).toBe(true);
    expect(res.cookies).toEqual([]);
    expect((await post({ token: await idToken("uid-nobody") })).body.needsVerify).toBe(true);
  });

  it("refuses when the channel record is linked to a different account", async () => {
    link("uid-1", "UCme");
    store.set("channels/UCme", { channelId: "UCme", channel: "@me", email: null, uid: "uid-2" });
    const res = await post({ token: await idToken("uid-1") });
    expect(res.status).toBe(404);
    expect(res.cookies).toEqual([]);
    store.delete("channels/UCme");
    expect((await post({ token: await idToken("uid-1") })).status).toBe(404);
  });

  it("refuses when the channel was verified with a different Google email", async () => {
    link("uid-1", "UCme", { email: "someone-else@example.com" });
    const res = await post({ token: await idToken("uid-1") });
    expect(res.status).toBe(404);
    expect(res.body.needsVerify).toBe(true);
  });

  it("only compares a Google-verified email", async () => {
    link("uid-1", "UCme");
    // Same address, but unverified and not a Google sign-in: never matches.
    const unverified = await post({ token: await idToken("uid-1", { emailVerified: false, provider: "password" }) });
    expect(unverified.status).toBe(404);
    expect(unverified.cookies).toEqual([]);
    // No email on the token while the channel has one on file: refused.
    expect((await post({ token: await idToken("uid-1", { email: null }) })).status).toBe(404);
    // provider=google.com alone does not make an email verified.
    expect((await post({ token: await idToken("uid-1", { emailVerified: false, provider: "google.com" }) })).status).toBe(404);
    expect((await post({ token: await idToken("uid-1", { emailVerified: true, provider: "google.com" }) })).status).toBe(200);
  });

  it("never lets an unverified email from a google.com sign-in reach the cookie or comp check", async () => {
    // Attack: account email changed via the Auth REST API, then a Google popup sign-in.
    process.env.PLUS_COMP_EMAILS = "boss@example.com";
    link("uid-1", "UCme", { email: null });
    const res = await post({
      token: await idToken("uid-1", { email: "boss@example.com", emailVerified: false, provider: "google.com" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(false);
    expect((await readYtAccount(res.cookie("yt_account")))?.email).toBeNull();
    expect(await readPlusEntitlement(res.cookie("matchcut_plus"))).toBeNull();
    expect(JSON.stringify(res.cookies)).not.toContain("boss");
    expect(store.get("users/uid-1")?.plus).not.toBe(true);
  });

  it("does not use an unverified token email for comp Plus", async () => {
    process.env.PLUS_COMP_EMAILS = "uid-1@example.com";
    link("uid-1", "UCme", { email: null });
    const res = await post({ token: await idToken("uid-1", { emailVerified: false, provider: "password" }) });
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(false);
    expect((await readYtAccount(res.cookie("yt_account")))?.email).toBeNull();
  });

  it("keeps paid Plus: re-issues the Plus cookie for the stored entitlement", async () => {
    link("uid-1", "UCme");
    const until = Date.now() + 10 * 86_400_000;
    store.set("entitlements/UCme", { plusUntil: until });
    const res = await post({ token: await idToken("uid-1") });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ premium: true, premiumUntil: until });
    const plus = await readPlusEntitlement(res.cookie("matchcut_plus"));
    expect(plus).toMatchObject({ channelId: "UCme", premiumUntil: until, source: "stripe" });
    // Public badge mirrored onto the profile by the server.
    expect(store.get("users/uid-1")?.plus).toBe(true);
  });

  it("applies comp Plus from PLUS_COMP_EMAILS using the server-held verified email", async () => {
    process.env.PLUS_COMP_EMAILS = "uid-1@example.com";
    link("uid-1", "UCme");
    const res = await post({ token: await idToken("uid-1") });
    expect(res.body).toMatchObject({ premium: true });
    expect((await readPlusEntitlement(res.cookie("matchcut_plus")))?.source).toBe("comp");
  });

  it("refuses cross-site requests", async () => {
    link("uid-1", "UCme");
    const token = await idToken("uid-1");
    expect((await post({ token, headers: { Origin: "https://evil.example" } })).status).toBe(403);
    expect((await post({ token, headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(403);
  });

  it("rate-limits and reports 503 without storage", async () => {
    link("uid-1", "UCme");
    const token = await idToken("uid-1");
    const statuses: number[] = [];
    for (let i = 0; i < 22; i += 1) statuses.push((await post({ token })).status);
    expect(statuses.at(-1)).toBe(429);
    resetRateLimitForTests();
    storageOn = false;
    const res = await post({ token });
    expect(res.status).toBe(503);
    expect(res.body.needsVerify).toBe(false);
  });
});
