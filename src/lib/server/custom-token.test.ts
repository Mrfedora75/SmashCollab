import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, importSPKI, jwtVerify } from "jose";
import type { Plain } from "@/lib/server/firestore.server";

// ---- test service account + in-memory Firestore ---------------------------
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SERVICE_EMAIL = "firebase-adminsdk-test@demo-smash.iam.gserviceaccount.com";
const savedEnv = { ...process.env };
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: "demo-smash",
  client_email: SERVICE_EMAIL,
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});

const store = new Map<string, Record<string, Plain>>();
let storageOn = true;

vi.mock("@/lib/server/firestore.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/firestore.server")>();
  return {
    ...actual,
    isStorageConfigured: () => storageOn,
    getDocument: async (path: string) => (store.has(path) ? { ...store.get(path)! } : null),
  };
});

const { handleCustomTokenRequest, resetRateLimitForTests } = await import("@/lib/server/custom-token.server");
const { signYtAccount } = await import("@/lib/youtube/plus-entitlement");

afterAll(() => {
  process.env = { ...savedEnv };
});

beforeEach(() => {
  store.clear();
  storageOn = true;
  resetRateLimitForTests();
});

function link(channelId: string, uid: string) {
  store.set(`channels/${channelId}`, { channelId, uid, linkedAt: Date.now() });
  store.set(`users/${uid}`, { uid, channel: "@me", verifiedChannelId: channelId });
}

async function post(opts: { cookie?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { Host: "smashcollab.com", ...opts.headers };
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await handleCustomTokenRequest(
    new Request("https://smashcollab.com/api/firebase/custom-token", { method: "POST", headers }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, cache: res.headers.get("cache-control") };
}

async function accountCookie(channelId = "UCme") {
  return `yt_account=${await signYtAccount(channelId, "@me", "me@example.com")}`;
}

describe("POST /api/firebase/custom-token", () => {
  it("asks for YouTube verification when the yt_account cookie is missing", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: expect.any(String), needsVerify: true });
  });

  it("rejects a forged or malformed yt_account cookie", async () => {
    link("UCme", "uid-1");
    const forged = await new SignJWT({ channelId: "UCme" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("attacker"));
    expect((await post({ cookie: `yt_account=${forged}` })).status).toBe(401);
    expect((await post({ cookie: "yt_account=not-a-jwt" })).status).toBe(401);
  });

  it("rejects an expired yt_account cookie", async () => {
    link("UCme", "uid-1");
    const expired = await new SignJWT({ channelId: "UCme" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode("test-google-secret"));
    expect((await post({ cookie: `yt_account=${expired}` })).status).toBe(401);
  });

  it("returns 404 needsVerify for a channel with no linked uid (first sign-in)", async () => {
    const res = await post({ cookie: await accountCookie("UCnew") });
    expect(res.status).toBe(404);
    expect(res.body.needsVerify).toBe(true);
    expect(res.body).not.toHaveProperty("token");
  });

  it("returns 404 when the linked profile no longer claims this channel", async () => {
    link("UCme", "uid-1");
    store.set("users/uid-1", { uid: "uid-1", verifiedChannelId: "UCother" });
    expect((await post({ cookie: await accountCookie() })).status).toBe(404);
    store.delete("users/uid-1");
    expect((await post({ cookie: await accountCookie() })).status).toBe(404);
  });

  it("mints a Firebase custom token for the linked uid", async () => {
    link("UCme", "uid-1");
    const res = await post({ cookie: await accountCookie() });
    expect(res.status).toBe(200);
    expect(res.cache).toBe("no-store");
    expect(Object.keys(res.body)).toEqual(["token"]);
    const key = await importSPKI(publicKey.export({ type: "spki", format: "pem" }).toString(), "RS256");
    const { payload, protectedHeader } = await jwtVerify(String(res.body.token), key, {
      issuer: SERVICE_EMAIL,
      subject: SERVICE_EMAIL,
      audience: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    });
    expect(protectedHeader.alg).toBe("RS256");
    expect(payload.uid).toBe("uid-1");
    expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(3600);
    expect(JSON.stringify(res.body)).not.toContain("PRIVATE KEY");
  });

  it("refuses cross-site requests", async () => {
    link("UCme", "uid-1");
    const cookie = await accountCookie();
    expect((await post({ cookie, headers: { Origin: "https://evil.example" } })).status).toBe(403);
    expect((await post({ cookie, headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(403);
    expect((await post({ cookie, headers: { Origin: "https://smashcollab.com" } })).status).toBe(200);
  });

  it("rate-limits repeated requests", async () => {
    link("UCme", "uid-1");
    const cookie = await accountCookie();
    const statuses: number[] = [];
    for (let i = 0; i < 22; i += 1) statuses.push((await post({ cookie })).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("reports 503 (not needsVerify) when the server has no service account", async () => {
    link("UCme", "uid-1");
    storageOn = false;
    const res = await post({ cookie: await accountCookie() });
    expect(res.status).toBe(503);
    expect(res.body.needsVerify).toBe(false);
  });
});
