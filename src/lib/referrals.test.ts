import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plain, Write } from "@/lib/server/firestore.server";

// ---- in-memory stand-in for the service-account Firestore client ----------
const store = new Map<string, Record<string, Plain>>();

vi.mock("@/lib/server/firestore.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/firestore.server")>();
  return {
    ...actual,
    isStorageConfigured: () => true,
    getDocument: async (path: string) => (store.has(path) ? { ...store.get(path)! } : null),
    runTransaction: async <T,>(body: (tx: { get: (p: string) => Promise<Record<string, Plain> | null> }) => Promise<{ writes: Write[]; result: T }>) => {
      const planned = await body({ get: async (path) => (store.has(path) ? { ...store.get(path)! } : null) });
      for (const w of planned.writes) {
        const doc = { ...(store.get(w.path) ?? {}), ...w.fields };
        for (const [k, by] of Object.entries(w.increment ?? {})) doc[k] = (typeof doc[k] === "number" ? (doc[k] as number) : 0) + by;
        store.set(w.path, doc);
      }
      return planned.result;
    },
    commit: async (writes: Write[]) => {
      for (const w of writes) {
        const doc = { ...(store.get(w.path) ?? {}), ...w.fields };
        for (const [k, by] of Object.entries(w.increment ?? {})) doc[k] = (typeof doc[k] === "number" ? (doc[k] as number) : 0) + by;
        for (const [k, v] of Object.entries(w.maximum ?? {})) doc[k] = Math.max(typeof doc[k] === "number" ? (doc[k] as number) : 0, v);
        store.set(w.path, doc);
      }
    },
  };
});

vi.mock("@/lib/stripe-billing.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe-billing.server")>()),
  grantReferralPlus: async () => undefined,
}));
const { readReferralReward, claimReferral } = await import("@/lib/referrals.server");
const { INVITE_REWARDS_PER_MONTH } = await import("@/lib/referrals");
const { resolveStoredPlus } = await import("@/lib/youtube/plus-entitlement");

beforeEach(() => {
  store.clear();
  delete process.env.PLUS_COMP_EMAILS;
  delete process.env.PLUS_COMP_CHANNEL_IDS;
});

describe("invite reward ownership", () => {
  it("credits invite Plus only to the channel that registered the code", async () => {
    const until = Date.now() + 14 * 24 * 60 * 60 * 1000;
    store.set("referralCodes/foo-bar", { code: "foo-bar", channelId: "UCowner" });
    store.set("referralRewards/foo-bar", { code: "foo-bar", plusUntil: until, invites: 1 });

    expect(await readReferralReward("foo-bar", "UCowner")).toBe(until);
    // "@foo_bar" / "@foo.bar" slug to the same code but are different channels.
    expect(await readReferralReward("foo-bar", "UCimpostor")).toBe(0);

    expect((await resolveStoredPlus({ channelId: "UCowner", channel: "@foo-bar", email: null })).premium).toBe(true);
    expect((await resolveStoredPlus({ channelId: "UCimpostor", channel: "@foo_bar", email: null })).premium).toBe(false);
  });

  it("grants nothing for an unregistered code", async () => {
    store.set("referralRewards/ghost", { code: "ghost", plusUntil: Date.now() + 60_000, invites: 1 });
    expect(await readReferralReward("ghost", "UCany")).toBe(0);
  });
});

describe("invite reward cap", () => {
  it(`rewards the inviter at most ${INVITE_REWARDS_PER_MONTH} times per calendar month`, async () => {
    store.set("referralCodes/host", { code: "host", channelId: "UChost" });
    const results = [];
    for (let i = 0; i < INVITE_REWARDS_PER_MONTH + 2; i += 1) {
      results.push(await claimReferral("host", { channelId: `UCnew${i}`, channel: `@new${i}` }));
    }
    expect(results.filter((r) => r.inviterRewarded).length).toBe(INVITE_REWARDS_PER_MONTH);
    expect(results.every((r) => r.ok && r.refereePlusUntil > 0)).toBe(true);
    expect(store.get("referralRewards/host")?.invites).toBe(INVITE_REWARDS_PER_MONTH + 2);
    const again = await claimReferral("host", { channelId: "UCnew0", channel: "@new0" });
    expect(again.already).toBe(true);
  });
});
