/**
 * Owner-only signup counts: GET /api/owner/stats (JSON, Bearer token) and GET /owner/stats (HTML, ?key=).
 * Locked by the OWNER_STATS_TOKEN env var. Unset = feature disabled (404). Counts only, never names/emails/ids.
 * The token is never logged or echoed back.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { countDocuments, isStorageConfigured } from "@/lib/server/firestore.server";

export type OwnerStats = { totalMembers: number; signupsToday: number; signupsLast24h: number; signupsLast7d: number };
type Counter = (filter?: { field: string; sinceMs: number }) => Promise<number>;

/** Profiles live in users/{uid}; createdAt is set (server timestamp) when the profile is first saved. */
export const SIGNUP_COLLECTION = "users";
export const SIGNUP_FIELD = "createdAt";

const baseHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time check. False when the env var is unset or the candidate is missing. */
export function tokenMatches(candidate: string | null | undefined, expected = process.env.OWNER_STATS_TOKEN): boolean {
  if (!expected || !candidate) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

export const ownerStatsEnabled = () => Boolean(process.env.OWNER_STATS_TOKEN);

/** Milliseconds for the most recent midnight in America/New_York. */
export function newYorkMidnight(now = Date.now()): number {
  const parts = (t: number) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date(t))
        .map((p) => [p.type, p.value]),
    );
  const offsetAt = (t: number) => {
    const p = parts(t);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
  };
  const p = parts(now);
  const utcMidnight = Date.UTC(+p.year, +p.month - 1, +p.day);
  let guess = utcMidnight - offsetAt(now);
  guess = utcMidnight - offsetAt(guess); // correct for a DST change between midnight and now
  return guess;
}

export async function loadOwnerStats(count: Counter, now = Date.now()): Promise<OwnerStats> {
  const since = (sinceMs: number) => count({ field: SIGNUP_FIELD, sinceMs });
  const [totalMembers, signupsToday, signupsLast24h, signupsLast7d] = await Promise.all([
    count(),
    since(newYorkMidnight(now)),
    since(now - 24 * 3600e3),
    since(now - 7 * 24 * 3600e3),
  ]);
  return { totalMembers, signupsToday, signupsLast24h, signupsLast7d };
}

const defaultCounter: Counter = (filter) => countDocuments(SIGNUP_COLLECTION, filter);

function notFound() {
  return new Response("Not found", { status: 404, headers: baseHeaders });
}

export async function handleOwnerStatsApi(request: Request, count: Counter = defaultCounter): Promise<Response> {
  if (!ownerStatsEnabled()) return notFound();
  const header = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!tokenMatches(bearer)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: baseHeaders });
  if (!isStorageConfigured()) return Response.json({ error: "Storage not configured" }, { status: 503, headers: baseHeaders });
  try {
    return Response.json(await loadOwnerStats(count), { headers: baseHeaders });
  } catch {
    return Response.json({ error: "Could not load stats" }, { status: 503, headers: baseHeaders });
  }
}

const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Owner stats</title><style>body{font-family:system-ui,sans-serif;background:#111;color:#f5efe6;max-width:28rem;margin:2rem auto;padding:0 1rem}dl{display:grid;grid-template-columns:1fr auto;gap:.75rem 1rem;font-size:1.25rem}dd{margin:0;font-weight:700;text-align:right}small{color:#a89f94}</style></head><body>${body}</body></html>`,
    { status, headers: { ...baseHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );

/** HTML page. The key is checked on every load; nothing is stored (no cookie). */
export async function handleOwnerStatsPage(request: Request, count: Counter = defaultCounter): Promise<Response> {
  if (!ownerStatsEnabled()) return notFound();
  const key = new URL(request.url).searchParams.get("key");
  if (!tokenMatches(key)) return html("<h1>Owner stats</h1><p>Wrong or missing key.</p>", 401);
  if (!isStorageConfigured()) return html("<h1>Owner stats</h1><p>Storage is not configured.</p>", 503);
  try {
    const s = await loadOwnerStats(count);
    const n = (v: number) => v.toLocaleString("en-US");
    return html(
      `<h1>Smash Collab members</h1><dl><dt>Total members</dt><dd>${n(s.totalMembers)}</dd><dt>Signed up today</dt><dd>${n(s.signupsToday)}</dd><dt>Last 24 hours</dt><dd>${n(s.signupsLast24h)}</dd><dt>Last 7 days</dt><dd>${n(s.signupsLast7d)}</dd></dl><p><small>"Today" starts at midnight New York time. Refresh for the latest numbers.</small></p>`,
    );
  } catch {
    return html("<h1>Owner stats</h1><p>Could not load stats right now.</p>", 503);
  }
}
