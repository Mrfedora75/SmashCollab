import { afterEach, describe, expect, it, vi } from "vitest";
import { fillFromSaved, profileFromDoc, reverifiedProfile } from "@/lib/profile-merge";
import { loadProfile, saveProfile, type DeskProfile } from "@/components/matchcut/onboarding-storage";
import { resolveNotificationsEnabled } from "@/lib/push-pref";

const base: DeskProfile = {
  displayName: "Warren",
  channel: "@warren",
  channelId: "UCw",
  subscribers: 1100,
  avgViews: 50,
  niches: ["Paranormal"],
  bio: "",
  avatar: null,
  country: "",
  state: null,
  county: "",
};
const doc = { channel: "@warren", channelId: "UCw", niches: ["Paranormal"], avgViews: 50 };

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("notificationsEnabled on the account profile", () => {
  it("loads the saved choice from the account", () => {
    expect(profileFromDoc({ ...doc, notificationsEnabled: true })?.notificationsEnabled).toBe(true);
    expect(profileFromDoc({ ...doc, notificationsEnabled: false })?.notificationsEnabled).toBe(false);
  });

  it("leaves it unset for an older profile (or a bad value) so the device choice is used", () => {
    const older = profileFromDoc(doc);
    expect(older).not.toBeNull();
    expect(older && "notificationsEnabled" in older).toBe(false);
    expect(profileFromDoc({ ...doc, notificationsEnabled: "yes" })?.notificationsEnabled).toBeUndefined();
    expect(resolveNotificationsEnabled(older?.notificationsEnabled, true)).toBe(true);
    expect(resolveNotificationsEnabled(profileFromDoc({ ...doc, notificationsEnabled: false })?.notificationsEnabled, true)).toBe(false);
  });

  it("is filled from the saved profile when this device has no choice, and kept when it has one", () => {
    expect(fillFromSaved(base, { notificationsEnabled: true }).notificationsEnabled).toBe(true);
    expect(fillFromSaved({ ...base, notificationsEnabled: false }, { notificationsEnabled: true }).notificationsEnabled).toBe(false);
    expect(fillFromSaved(base, {}).notificationsEnabled).toBeUndefined();
  });

  it("survives a YouTube re-verify", () => {
    const verified = { displayName: "W", channel: "@warren", channelId: "UCw", subscribers: 1, avgViews: 1, avatar: null };
    expect(reverifiedProfile({ ...base, notificationsEnabled: true }, verified).notificationsEnabled).toBe(true);
    expect(reverifiedProfile(base, verified).notificationsEnabled).toBeUndefined();
  });

  it("round-trips through this device's saved profile", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveProfile({ ...base, notificationsEnabled: true });
    expect(loadProfile()?.notificationsEnabled).toBe(true);
    saveProfile(base);
    expect(loadProfile()?.notificationsEnabled).toBeUndefined();
  });
});
