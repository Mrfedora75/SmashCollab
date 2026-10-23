import { describe, expect, it } from "vitest";
import type { Creator } from "@/data/creators";
import {
  collabFit,
  compareByCollabFit,
  type FitViewer,
} from "@/lib/collab-fit";
import { visibleCreators } from "@/lib/deck-store";

function creator(
  partial: Partial<Creator> & Pick<Creator, "id" | "channel">,
): Creator {
  return {
    name: partial.channel,
    subscribers: 20_000,
    avgViews: 8_000,
    niches: [],
    location: "remote",
    state: null,
    county: null,
    videoTitle: "",
    duration: "",
    thumb: "",
    openTo: "collabs",
    fit: 0,
    rating: 0,
    ...partial,
  };
}

const viewer: FitViewer = {
  niches: ["Cooking", "Travel"],
  subscribers: 20_000,
  avgViews: 8_000,
  country: "us",
  state: "Ohio",
  county: "Franklin",
};

describe("collabFit", () => {
  it("scores a close match out of 100 and explains the strongest reasons", () => {
    const fit = collabFit(
      viewer,
      creator({
        id: "twin",
        channel: "@twin",
        niches: ["Travel", "Cooking"],
        subscribers: 22_000,
        avgViews: 8_400,
        location: "us",
        state: "Ohio",
        county: "Franklin County",
      }),
    );
    expect(fit.parts).toEqual({
      niches: 60,
      size: 20,
      place: 12,
      reach: 5,
      activity: 3,
    });
    expect(fit.score).toBe(100);
    expect(fit.reason).toBe("2 shared niches · similar size · same county");
    expect(fit.shared).toEqual(["cooking", "travel"]);
  });

  it("weights shared niches above size, place, and reach combined", () => {
    const nicheMatch = collabFit(
      viewer,
      creator({
        id: "niches",
        channel: "@niches",
        niches: ["Cooking", "Travel"],
        subscribers: 5_000_000,
        avgViews: 10,
        location: "uk",
      }),
    );
    const everywhereElse = collabFit(
      viewer,
      creator({
        id: "else",
        channel: "@else",
        niches: ["Gaming"],
        subscribers: 22_000,
        avgViews: 8_400,
        location: "us",
        state: "Ohio",
        county: "Franklin",
      }),
    );
    expect(nicheMatch.parts.niches).toBe(60);
    expect(nicheMatch.score).toBeGreaterThan(everywhereElse.score ?? 0);
    expect(everywhereElse.reason.startsWith("no shared niches")).toBe(true);
  });

  it("gives partial credit for one shared niche, the same state, and a similar size", () => {
    const fit = collabFit(
      viewer,
      creator({
        id: "partial",
        channel: "@partial",
        niches: ["cooking"],
        subscribers: 15_000,
        avgViews: 7_000,
        location: "us",
        state: "Ohio",
      }),
    );
    expect(fit.parts.niches).toBe(30);
    expect(fit.parts.place).toBe(9);
    expect(fit.parts.size).toBe(20);
    expect(fit.reason).toBe("1 shared niche · similar size · same state");
    expect(fit.score).toBe(67);
  });

  it("matches niches and states without caring about case or a trailing County", () => {
    const fit = collabFit(
      { ...viewer, niches: ["Cooking", " cooking ", "COOKING"], state: "OHIO" },
      creator({
        id: "case",
        channel: "@case",
        niches: ["cooking"],
        location: "us",
        state: "Ohio",
        county: "franklin county",
      }),
    );
    expect(fit.parts.niches).toBe(48);
    expect(fit.parts.place).toBe(12);
    expect(fit.shared).toEqual(["cooking"]);
  });

  it("skips size and reach when a count is missing, and still returns a score", () => {
    const fit = collabFit(
      { ...viewer, subscribers: 0, avgViews: 0 },
      creator({
        id: "quiet",
        channel: "@quiet",
        niches: ["Cooking", "Travel"],
        subscribers: 0,
        avgViews: 0,
      }),
    );
    expect(fit.parts.size).toBe(0);
    expect(fit.parts.reach).toBe(0);
    expect(fit.parts.activity).toBe(0);
    expect(fit.score).toBe(60);
    expect(fit.reason).toBe("2 shared niches");
  });

  it("returns no score when the viewer has no profile or no niches", () => {
    const channel = creator({
      id: "any",
      channel: "@any",
      niches: ["Cooking"],
      fit: 99,
    });
    expect(collabFit(null, channel)).toEqual({
      score: null,
      reason: "",
      shared: [],
      parts: { niches: 0, size: 0, place: 0, reach: 0, activity: 0 },
    });
    expect(collabFit({ ...viewer, niches: [] }, channel).score).toBeNull();
    expect(collabFit({ ...viewer, niches: ["  "] }, channel).score).toBeNull();
  });

  it("keeps the score inside 0–100", () => {
    const fit = collabFit(
      viewer,
      creator({
        id: "bounds",
        channel: "@bounds",
        niches: ["Cooking", "Travel", "Home", "DIY"],
        subscribers: 20_000,
        avgViews: 8_000,
        location: "us",
        state: "Ohio",
        county: "Franklin",
      }),
    );
    expect(fit.score).toBeGreaterThanOrEqual(0);
    expect(fit.score).toBeLessThanOrEqual(100);
  });
});

describe("Collab fit sort", () => {
  const deck = {
    niches: [] as string[],
    minBracket: 0,
    maxBracket: 2,
    location: "global" as const,
    usState: null,
    sort: "fit" as const,
    swipes: [],
  };

  const strong = creator({
    id: "strong",
    channel: "@strong",
    niches: ["Cooking", "Travel"],
    subscribers: 22_000,
    location: "us",
    state: "Ohio",
    county: "Franklin",
    fit: 0,
  });
  const weak = creator({
    id: "weak",
    channel: "@aaa-weak",
    niches: ["Gaming"],
    subscribers: 22_000,
    location: "uk",
    fit: 99,
  });
  const mid = creator({
    id: "mid",
    channel: "@mid",
    niches: ["Cooking"],
    subscribers: 18_000,
    location: "us",
    state: "California",
    fit: 0,
  });

  it("ranks better overlap first and ignores the stored fit field", () => {
    expect(compareByCollabFit(viewer, weak, strong)).toBeGreaterThan(0);
    const { unseen } = visibleCreators({ ...deck, me: viewer }, [
      weak,
      mid,
      strong,
    ]);
    expect(unseen.map((item) => item.id)).toEqual(["strong", "mid", "weak"]);
  });

  it("breaks ties by channel name", () => {
    const alpha = creator({
      id: "a",
      channel: "@alpha",
      niches: ["Cooking", "Travel"],
    });
    const zeta = creator({
      id: "z",
      channel: "@zeta",
      niches: ["Cooking", "Travel"],
    });
    const { unseen } = visibleCreators({ ...deck, me: viewer }, [zeta, alpha]);
    expect(unseen.map((item) => item.channel)).toEqual(["@alpha", "@zeta"]);
  });

  it("leaves average-views and subscriber sorts alone", () => {
    const small = creator({
      id: "s",
      channel: "@small",
      subscribers: 100,
      avgViews: 9_000,
      niches: ["Cooking", "Travel"],
    });
    const big = creator({
      id: "b",
      channel: "@big",
      subscribers: 90_000,
      avgViews: 100,
      niches: ["Gaming"],
    });
    expect(
      visibleCreators({ ...deck, sort: "views", me: viewer }, [
        big,
        small,
      ]).unseen.map((item) => item.id),
    ).toEqual(["s", "b"]);
    expect(
      visibleCreators({ ...deck, sort: "subs", me: viewer }, [
        small,
        big,
      ]).unseen.map((item) => item.id),
    ).toEqual(["b", "s"]);
  });

  it("falls back to A–Z when the viewer has no niches, even if stored fit differs", () => {
    const { unseen } = visibleCreators(
      { ...deck, me: { ...viewer, niches: [] } },
      [weak, strong],
    );
    expect(unseen.map((item) => item.channel)).toEqual([
      "@aaa-weak",
      "@strong",
    ]);
    expect(
      visibleCreators({ ...deck, me: null }, [strong, weak]).unseen.map(
        (item) => item.id,
      ),
    ).toEqual(["weak", "strong"]);
  });
});
