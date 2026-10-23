/**
 * Per-viewer collab fit, scored in the browser from fields both profiles already have.
 *
 * 100 points:
 *   60 shared niches — strongest signal. More of the viewer's niches in common scores
 *      higher, and two shared niches score higher than one.
 *   20 channel size — same subscriber bracket, plus a bump when the counts are close.
 *   12 location — same US county, else same US state, else the same region.
 *   5  average views — similar typical reach.
 *   3  activity — similar average-views-per-subscriber.
 *
 * A viewer with no niches gets a null score. Ranking and the card badge both wait
 * until that strongest signal exists, instead of showing a hollow number.
 */
import { bracketIndex, type Creator, type Region } from "@/data/creators";

export type FitViewer = {
  niches: string[];
  subscribers: number;
  avgViews?: number;
  country?: string | null;
  state?: string | null;
  county?: string | null;
};

export type FitParts = {
  niches: number;
  size: number;
  place: number;
  reach: number;
  activity: number;
};

export type CollabFit = {
  /** Null when the viewer has no niches yet. */
  score: number | null;
  /** Up to three short clauses, joined with " · ". */
  reason: string;
  /** Lowercased niche names in common. */
  shared: string[];
  parts: FitParts;
};

const EMPTY_PARTS: FitParts = {
  niches: 0,
  size: 0,
  place: 0,
  reach: 0,
  activity: 0,
};

const NICHE_COVERAGE = 36;
const NICHE_DEPTH = 24;
const SIZE_CAP = 20;

function nicheKeys(niches: string[]): Set<string> {
  const keys = new Set<string>();
  for (const niche of niches) {
    const key = niche.trim().toLowerCase();
    if (key) keys.add(key);
  }
  return keys;
}

function viewerRegion(country: string | null | undefined): Region | null {
  if (
    country === "us" ||
    country === "uk" ||
    country === "europe" ||
    country === "latam"
  )
    return country;
  return null;
}

function sameText(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return left.length > 0 && left === right;
}

function countyKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+county$/, "")
    .trim();
}

/** Full points within ~1.6×, nothing once the values are 10× apart. */
function logCloseness(a: number, b: number, max: number): number {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b))
    return 0;
  const diff = Math.abs(Math.log10(a) - Math.log10(b));
  if (diff <= 0.2) return max;
  if (diff >= 1) return 0;
  return Math.round(max * (1 - (diff - 0.2) / 0.8));
}

function nichePoints(shared: number, viewerCount: number): number {
  if (viewerCount === 0 || shared === 0) return 0;
  const coverage = shared / viewerCount;
  const depth = Math.min(shared, 2) / 2;
  return Math.round(coverage * NICHE_COVERAGE + depth * NICHE_DEPTH);
}

function sizePoints(viewerSubs: number, creatorSubs: number): number {
  if (!(viewerSubs > 0) || !(creatorSubs > 0)) return 0;
  const gap = Math.abs(bracketIndex(viewerSubs) - bracketIndex(creatorSubs));
  let points = gap === 0 ? 12 : gap === 1 ? 5 : 0;
  const ratio =
    Math.max(viewerSubs, creatorSubs) / Math.min(viewerSubs, creatorSubs);
  if (ratio <= 2) points += 8;
  else if (ratio <= 4) points += 4;
  return Math.min(SIZE_CAP, points);
}

function placeScore(
  viewer: FitViewer,
  creator: Creator,
): { points: number; phrase: string | null } {
  const region = viewerRegion(viewer.country);
  if (!region || creator.location !== region)
    return { points: 0, phrase: null };
  const sameState = region === "us" && sameText(viewer.state, creator.state);
  const county = countyKey(viewer.county);
  if (sameState && county && county === countyKey(creator.county)) {
    return { points: 12, phrase: "same county" };
  }
  if (sameState) return { points: 9, phrase: "same state" };
  const phrase =
    region === "us"
      ? "both in the US"
      : region === "uk"
        ? "both in the UK"
        : region === "europe"
          ? "both in Europe"
          : "both in Latin America";
  return { points: 6, phrase };
}

function fitReason(input: {
  viewerNiches: number;
  shared: number;
  size: number;
  placePhrase: string | null;
  reach: number;
  activity: number;
}): string {
  const parts: string[] = [];
  if (input.viewerNiches > 0) {
    parts.push(
      input.shared === 0
        ? "no shared niches"
        : input.shared === 1
          ? "1 shared niche"
          : `${input.shared} shared niches`,
    );
  }
  if (input.size >= 12) parts.push("similar size");
  else if (input.size >= 8) parts.push("nearby size");
  if (input.placePhrase) parts.push(input.placePhrase);
  if (parts.length < 3 && input.reach >= 3) parts.push("similar reach");
  if (parts.length < 3 && input.activity >= 2) parts.push("similar activity");
  return parts.slice(0, 3).join(" · ");
}

export function collabFit(
  viewer: FitViewer | null | undefined,
  creator: Creator,
): CollabFit {
  const viewerNiches = viewer ? nicheKeys(viewer.niches) : new Set<string>();
  if (!viewer || viewerNiches.size === 0) {
    return { score: null, reason: "", shared: [], parts: EMPTY_PARTS };
  }
  const creatorNiches = nicheKeys(creator.niches);
  const shared = [...viewerNiches].filter((niche) => creatorNiches.has(niche));
  const niches = nichePoints(shared.length, viewerNiches.size);
  const size = sizePoints(viewer.subscribers, creator.subscribers);
  const place = placeScore(viewer, creator);
  const reach = logCloseness(viewer.avgViews ?? 0, creator.avgViews, 5);
  const viewerRate =
    viewer.subscribers > 0 ? (viewer.avgViews ?? 0) / viewer.subscribers : 0;
  const creatorRate =
    creator.subscribers > 0 ? creator.avgViews / creator.subscribers : 0;
  const activity = logCloseness(viewerRate, creatorRate, 3);
  const parts: FitParts = {
    niches,
    size,
    place: place.points,
    reach,
    activity,
  };
  const score = Math.max(
    0,
    Math.min(100, niches + size + place.points + reach + activity),
  );
  return {
    score,
    reason: fitReason({
      viewerNiches: viewerNiches.size,
      shared: shared.length,
      size,
      placePhrase: place.phrase,
      reach,
      activity,
    }),
    shared,
    parts,
  };
}

/** Higher fit first. No score (viewer has no niches) falls back to channel name. */
export function compareByCollabFit(
  viewer: FitViewer | null | undefined,
  a: Creator,
  b: Creator,
): number {
  const aScore = collabFit(viewer, a).score;
  const bScore = collabFit(viewer, b).score;
  if (aScore == null && bScore == null)
    return a.channel.localeCompare(b.channel);
  if (aScore == null) return 1;
  if (bScore == null) return -1;
  return bScore - aScore || a.channel.localeCompare(b.channel);
}
