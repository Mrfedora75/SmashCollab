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

const { readReferralReward } = await import("@/lib/referrals.server");
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
