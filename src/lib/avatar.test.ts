import { describe, expect, it } from "vitest";
import { AVATAR_MAX_CHARS, isDisplayableAvatar, isStorableAvatar, isUploadedAvatar } from "@/lib/avatar";

const small = `data:image/jpeg;base64,${"A".repeat(1000)}`;

describe("avatar rules", () => {
  it("accepts https photos and small uploaded JPEGs", () => {
    expect(isStorableAvatar("https://yt3.ggpht.com/abc")).toBe(true);
    expect(isStorableAvatar(small)).toBe(true);
    expect(isStorableAvatar(null)).toBe(true);
  });

  it("rejects oversized or non-image data URLs and plain http", () => {
    expect(isStorableAvatar(`data:image/jpeg;base64,${"A".repeat(AVATAR_MAX_CHARS)}`)).toBe(false);
    expect(isStorableAvatar("data:text/html;base64,PGgxPg==")).toBe(false);
    expect(isStorableAvatar("http://example.com/a.jpg")).toBe(false);
  });

  it("lets other members' uploaded photos display", () => {
    expect(isDisplayableAvatar(small)).toBe(true);
    expect(isDisplayableAvatar("https://x/y.jpg")).toBe(true);
    expect(isDisplayableAvatar("javascript:alert(1)")).toBe(false);
    expect(isDisplayableAvatar(42)).toBe(false);
  });

  it("recognizes uploads", () => {
    expect(isUploadedAvatar(small)).toBe(true);
    expect(isUploadedAvatar("https://x/y.jpg")).toBe(false);
  });
});
