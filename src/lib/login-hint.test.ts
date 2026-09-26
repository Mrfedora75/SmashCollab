import { describe, expect, it } from "vitest";
import { LOGIN_HINT_KEY, clearLoginHint, loadLoginHint, saveLoginHint, toLoginHint } from "@/lib/login-hint";

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("login hint", () => {
  it("round-trips only the display fields", () => {
    const s = memory();
    saveLoginHint(
      {
        channel: "@me",
        displayName: "Me",
        avatar: "https://yt3.ggpht.com/a.jpg",
        uid: "uid-1",
        // extra junk must never be persisted
        ...({ token: "secret", email: "me@example.com" } as object),
      },
      s,
    );
    const raw = s.map.get(LOGIN_HINT_KEY)!;
    expect(raw).not.toContain("secret");
    expect(raw).not.toContain("example.com");
    expect(loadLoginHint(s)).toEqual({ channel: "@me", displayName: "Me", avatar: "https://yt3.ggpht.com/a.jpg", uid: "uid-1" });
  });

  it("drops uploaded data: photos and non-https URLs", () => {
    expect(toLoginHint({ channel: "@me", avatar: "data:image/png;base64,AAAA" })?.avatar).toBeNull();
    expect(toLoginHint({ channel: "@me", avatar: "http://x.test/a.png" })?.avatar).toBeNull();
    expect(toLoginHint({ channel: "@me", avatar: "javascript:alert(1)" })?.avatar).toBeNull();
  });

  it("needs a channel and falls back to it for the name", () => {
    expect(toLoginHint({ displayName: "x" })).toBeNull();
    expect(toLoginHint({ channel: " @me " })).toEqual({ channel: "@me", displayName: "@me", avatar: null, uid: null });
  });

  it("ignores corrupt storage and can be cleared", () => {
    const s = memory();
    s.setItem(LOGIN_HINT_KEY, "{not json");
    expect(loadLoginHint(s)).toBeNull();
    saveLoginHint({ channel: "@me", displayName: "Me", avatar: null, uid: null }, s);
    clearLoginHint(s);
    expect(loadLoginHint(s)).toBeNull();
    saveLoginHint(null, s);
    expect(s.map.size).toBe(0);
  });
});
