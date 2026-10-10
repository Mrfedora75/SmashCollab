import { beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import type { Plain } from "@/lib/server/firestore.server";

vi.mock("@/lib/server/firestore.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/firestore.server")>()),
  isStorageConfigured: () => true,
  firebaseProjectId: () => "demo-smash",
}));

const { handleMembersRequest } = await import("@/lib/server/members.server");
const { setFirebaseKeysForTests } = await import("@/lib/server/firebase-auth.server");
let key: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  key = pair.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k", alg: "RS256", use: "sig" };
  setFirebaseKeysForTests(createLocalJWKSet({ keys: [jwk] }));
});

const token = (uid: string) =>
  new SignJWT({ email_verified: true, auth_time: Math.floor(Date.now() / 1000) })
    .setProtectedHeader({ alg: "RS256", kid: "k" })
    .setIssuer("https://securetoken.google.com/demo-smash")
    .setAudience("demo-smash")
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

describe("GET /api/members", () => {
  it("requires sign-in, pages, and returns only public profiles with public fields", async () => {
    const docs: { id: string; data: Record<string, Plain> }[] = [
      { id: "me", data: { channel: "@me", ageConfirmed: true, verifiedChannelId: "UCme" } },
      { id: "pub", data: { channel: "@pub", ageConfirmed: true, verifiedChannelId: "UCpub", email: "x@y.z", uid: "pub", subsVerifiedAt: 1 } },
      { id: "unverified", data: { channel: "@u", ageConfirmed: true } },
    ];
    const query = vi.fn(async (_c: string, _w: unknown, limit: number) => ({ docs, nextId: limit === docs.length ? "unverified" : null }));
    expect((await handleMembersRequest(new Request("http://x/api/members"), query)).status).toBe(401);
    const res = await handleMembersRequest(
      new Request("http://x/api/members?limit=999", { headers: { Authorization: `Bearer ${await token("me")}` } }),
      query,
    );
    const body = (await res.json()) as { members: Record<string, unknown>[] };
    expect(query.mock.calls[0][2]).toBe(50);
    expect(body.members).toEqual([{ id: "pub", channel: "@pub" }]);
  });
});
