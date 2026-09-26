import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: async () => ({ currentUser: { uid: "uid-1" } }),
}));
vi.mock("firebase/auth", () => ({ signOut: async () => {} }));

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
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

describe("logoutAndReset", () => {
  it("wipes private data but keeps the non-sensitive Continue-as hint", async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    local.setItem(
      "matchcut-profile",
      JSON.stringify({
        displayName: "Me",
        channel: "@me",
        channelId: "UCme",
        subscribers: 10,
        avgViews: 1,
        niches: ["Gaming"],
        bio: "private-ish bio",
        avatar: "https://yt3.ggpht.com/me.jpg",
      }),
    );
    local.setItem("matchcut-v1", "{\"chats\":\"secret chat\"}");
    local.setItem("matchcut-drafts", "draft pitch");
    local.setItem("matchcut-age", "adult");
    local.setItem("youtube-token", "ya29.secret");
    session.setItem("matchcut-temp", "x");
    const fetchMock = vi.fn(async () => new Response("{}"));
    const assign = vi.fn();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { assign } });

    const { logoutAndReset } = await import("@/lib/youtube/client-logout");
    await logoutAndReset();

    expect(fetchMock).toHaveBeenCalledWith("/api/youtube/logout", expect.objectContaining({ method: "POST" }));
    expect(assign).toHaveBeenCalledWith("/");
    expect(session.map.size).toBe(0);
    expect(Array.from(local.map.keys()).sort()).toEqual(["matchcut-age", "matchcut-signed-in", "smash-login-hint"]);
    const hint = local.getItem("smash-login-hint")!;
    expect(JSON.parse(hint)).toEqual({ channel: "@me", displayName: "Me", avatar: "https://yt3.ggpht.com/me.jpg", uid: "uid-1" });
    for (const secret of ["secret", "ya29", "draft", "bio", "UCme"]) expect(hint).not.toContain(secret);
  });
});
