import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  popupUser: { uid: "uid-1", getIdToken: async () => "id-token" } as { uid: string; getIdToken: () => Promise<string> },
  popupError: null as unknown,
  profileDoc: null as Record<string, unknown> | null,
  signOuts: 0,
  providerParams: [] as Array<Record<string, string>>,
}));

vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    params: Record<string, string> = {};
    setCustomParameters(p: Record<string, string>) {
      this.params = p;
      state.providerParams.push(p);
      return this;
    }
    static credential() {
      return {};
    }
  }
  return {
    GoogleAuthProvider,
    onAuthStateChanged: () => () => {},
    signInWithCredential: async () => ({}),
    signInWithCustomToken: async () => ({}),
    signInWithPopup: async () => {
      if (state.popupError) throw state.popupError;
      return { user: state.popupUser };
    },
    signOut: async () => {
      state.signOuts += 1;
    },
  };
});
vi.mock("firebase/firestore", () => ({
  deleteField: () => null,
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  getDoc: async () => ({ exists: () => state.profileDoc != null, data: () => state.profileDoc }),
  serverTimestamp: () => null,
  setDoc: async () => {},
}));
vi.mock("@/lib/firebase", () => ({
  firebaseAuth: async () => ({ currentUser: state.popupUser }),
  firebaseDb: async () => ({}),
}));
vi.mock("@/lib/collab", () => ({ syncProfileOnServer: async () => null }));

const { continueWithGoogle, googleProviderFor } = await import("@/lib/firebase-user");

const auth = {} as never;
let calls: Array<{ url: string; init?: RequestInit }> = [];

function stubFetch(restore: { status: number; body: Record<string, unknown> }) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "/api/auth/restore") return Response.json(restore.body, { status: restore.status });
      return Response.json({ ok: true });
    }),
  );
}

const fullProfile = { uid: "uid-1", channel: "@me", channelId: "UCme", niches: ["Gaming"], displayName: "Me" };

beforeEach(() => {
  state.popupError = null;
  state.profileDoc = fullProfile;
  state.signOuts = 0;
  state.providerParams = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("googleProviderFor", () => {
  it("skips the account picker with login_hint, shows it without a hint", () => {
    googleProviderFor("me@example.com");
    googleProviderFor(null);
    expect(state.providerParams).toEqual([{ login_hint: "me@example.com" }, { prompt: "select_account" }]);
  });
});

describe("continueWithGoogle", () => {
  it("passes the remembered email as login_hint and restores", async () => {
    stubFetch({ status: 200, body: { restored: true, channelId: "UCme", premium: false, premiumUntil: null } });
    const result = await continueWithGoogle(auth, "me@example.com");
    expect(state.providerParams.at(-1)).toEqual({ login_hint: "me@example.com" });
    expect(result.status).toBe("restored");
    expect(calls.map((c) => c.url)).toEqual(["/api/auth/restore"]);
    expect(state.signOuts).toBe(0);
  });

  it("clears the server cookies when the profile is missing after restore", async () => {
    state.profileDoc = null;
    stubFetch({ status: 200, body: { restored: true, channelId: "UCme" } });
    expect((await continueWithGoogle(auth, "me@example.com")).status).toBe("needsVerify");
    expect(calls.map((c) => c.url)).toEqual(["/api/auth/restore", "/api/youtube/logout"]);
    expect(calls[1].init?.method).toBe("POST");
    expect(state.signOuts).toBe(1);
  });

  it("clears the server cookies when the profile belongs to another channel", async () => {
    state.profileDoc = { ...fullProfile, channelId: "UCother" };
    stubFetch({ status: 200, body: { restored: true, channelId: "UCme" } });
    expect((await continueWithGoogle(auth)).status).toBe("needsVerify");
    expect(calls.map((c) => c.url)).toEqual(["/api/auth/restore", "/api/youtube/logout"]);
  });

  it("does not call logout when the server never restored anything", async () => {
    stubFetch({ status: 404, body: { error: "x", needsVerify: true } });
    expect((await continueWithGoogle(auth)).status).toBe("needsVerify");
    expect(calls.map((c) => c.url)).toEqual(["/api/auth/restore"]);
    expect(state.signOuts).toBe(1);
  });

  it("reports a closed popup as cancelled", async () => {
    state.popupError = { code: "auth/popup-closed-by-user" };
    stubFetch({ status: 500, body: {} });
    expect((await continueWithGoogle(auth)).status).toBe("cancelled");
    expect(calls).toEqual([]);
  });
});
