import { describe, expect, it } from "vitest";
import { fillFromSaved, profileFromDoc, reverifiedAvatar, reverifiedDisplayName } from "@/lib/profile-merge";
import type { DeskProfile } from "@/components/matchcut/onboarding-storage";

const fresh: DeskProfile = {
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

describe("fillFromSaved (onboarding never blanks a saved profile)", () => {
  it("keeps the saved bio, country, state, and county when this device has none", () => {
    const saved = { bio: "Ghost hunts in PA", country: "us", state: "Pennsylvania", county: "Warren", avatar: "https://x/y.jpg" };
    const next = fillFromSaved(fresh, saved);
    expect(next.bio).toBe("Ghost hunts in PA");
    expect(next.country).toBe("us");
    expect(next.state).toBe("Pennsylvania");
    expect(next.county).toBe("Warren");
    expect(next.avatar).toBe("https://x/y.jpg");
  });

  it("lets values typed on this device win", () => {
    const next = fillFromSaved({ ...fresh, bio: "New bio", country: "uk" }, { bio: "Old", country: "us", state: "Ohio" });
    expect(next.bio).toBe("New bio");
    expect(next.country).toBe("uk");
    expect(next.state).toBeNull();
  });

  it("is a no-op without a saved profile", () => {
    expect(fillFromSaved(fresh, null)).toEqual(fresh);
  });
});

describe("profileFromDoc", () => {
  it("prefers the server-verified subscriber count and drops bad fields", () => {
    const p = profileFromDoc({ channel: "@w", niches: ["A"], subscriberCount: 1200, subscribers: 5, country: "mars", state: "Ohio" });
    expect(p?.subscribers).toBe(1200);
    expect(p?.country).toBe("");
    expect(p?.state).toBeNull();
  });

  it("returns null for unfinished profiles", () => {
    expect(profileFromDoc({ channel: "@w", niches: [] })).toBeNull();
    expect(profileFromDoc(null)).toBeNull();
  });
});

describe("reverifiedDisplayName (re-verify never overwrites an edited name)", () => {
  const verified = { displayName: "Warren Area Society of Paranormal", channelId: "UCw" };

  it("keeps the saved name for the same channel", () => {
    expect(reverifiedDisplayName({ displayName: "Mr. Fedora", channelId: "UCw" }, verified)).toBe("Mr. Fedora");
  });

  it("keeps the saved name when the saved profile has no channel id yet", () => {
    expect(reverifiedDisplayName({ displayName: "Mr. Fedora" }, verified)).toBe("Mr. Fedora");
  });

  it("uses the verified name for a different channel", () => {
    expect(reverifiedDisplayName({ displayName: "Someone Else", channelId: "UCother" }, verified)).toBe(verified.displayName);
  });

  it("uses the verified name when nothing is saved", () => {
    expect(reverifiedDisplayName({ displayName: "  ", channelId: "UCw" }, verified)).toBe(verified.displayName);
  });
});

describe("reverifiedAvatar (re-verify never overwrites an uploaded photo)", () => {
  const uploaded = "data:image/jpeg;base64,AAAA";
  const verified = { avatar: "https://yt3.ggpht.com/thumb", channelId: "UCw" };

  it("keeps an uploaded photo for the same channel", () => {
    expect(reverifiedAvatar({ avatar: uploaded, channelId: "UCw" }, verified)).toBe(uploaded);
  });

  it("refreshes a YouTube thumbnail from verification", () => {
    expect(reverifiedAvatar({ avatar: "https://old/thumb", channelId: "UCw" }, verified)).toBe(verified.avatar);
  });

  it("never carries another channel's photo", () => {
    expect(reverifiedAvatar({ avatar: uploaded, channelId: "UCother" }, { avatar: null, channelId: "UCw" })).toBeNull();
  });
});
