import { describe, expect, it } from "vitest";
import { fillFromSaved, profileFromDoc } from "@/lib/profile-merge";
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
