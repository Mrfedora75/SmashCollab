import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSessionStorageOnly } from "@/lib/youtube/client-logout";
import { PUSH_PREF_KEY, loadPushPref, savePushPref } from "@/lib/push-pref";

vi.mock("@/lib/firebase", () => ({ firebaseAuth: async () => null }));
vi.mock("firebase/auth", () => ({ signOut: async () => {} }));

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

describe("push notification preference", () => {
  it("is off until the creator turns it on", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(loadPushPref()).toBe(false);
  });

  it("remembers on and off", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    savePushPref(true);
    expect(loadPushPref()).toBe(true);
    savePushPref(false);
    expect(loadPushPref()).toBe(false);
  });

  it("survives the Log Out wipe", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", memoryStorage());
    storage.setItem("matchcut-profile", "{}");
    savePushPref(true);
    clearSessionStorageOnly();
    expect(storage.getItem("matchcut-profile")).toBeNull();
    expect(storage.getItem(PUSH_PREF_KEY)).toBe("1");
    expect(loadPushPref()).toBe(true);
  });
});

describe("resolveNotificationsEnabled (account first, device as fallback)", () => {
  it("uses the account's saved choice once the profile has loaded", async () => {
    const { resolveNotificationsEnabled } = await import("@/lib/push-pref");
    expect(resolveNotificationsEnabled(true, false)).toBe(true);
    expect(resolveNotificationsEnabled(false, true)).toBe(false);
  });

  it("falls back to this device before the profile loads or when an older profile has no choice", async () => {
    const { resolveNotificationsEnabled } = await import("@/lib/push-pref");
    expect(resolveNotificationsEnabled(undefined, true)).toBe(true);
    expect(resolveNotificationsEnabled(null, false)).toBe(false);
  });
});
