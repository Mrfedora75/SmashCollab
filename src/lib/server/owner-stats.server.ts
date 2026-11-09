/**
 * Owner-only signup counts: GET /api/owner/stats (JSON, Bearer token) and /owner/stats (HTML).
 * The HTML page takes the token in a POST body and then keeps a short HttpOnly cookie.
 * The token is never put in the URL, logged, or echoed back. Unset env = feature disabled (404).
 * Counts only, never names, emails, or ids.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { countDocuments, isStorageConfigured } from "@/lib/server/firestore.server";
import { isSecureRequest } from "@/lib/youtube/config";

export type OwnerStats = { totalMembers: number; signupsToday: number; signupsLast24h: number; signupsLast7d: number };
type Counter = (filter?: { field: string; sinceMs: number }) => Promise<number>;

/** Profiles live in users/{uid}; createdAt is set (server timestamp) when the profile is first saved. */
export const SIGNUP_COLLECTION = "users";
export const SIGNUP_FIELD = "createdAt";

const baseHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const SESSION_COOKIE = "owner_stats";
const SESSION_MAX_AGE_SEC = 8 * 60 * 60;
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 30;
const failures = new Map<string, { count: number; reset: number }>();

/** Tests only. */
export function resetOwnerStatsLimitsForTests(): void {
  failures.clear();
}

function clientIp(request: Request): string {
  return request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function tooManyFailures(ip: string, now = Date.now()): boolean {
  if (failures.size > 5000) {
    for (const [key, row] of failures) if (row.reset <= now) failures.delete(key);
  }
  const row = failures.get(ip);
  if (!row || row.reset <= now) {
    failures.set(ip, { count: 1, reset: now + FAIL_WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > FAIL_LIMIT;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

function sessionMac(token: string, exp: string): string {
  return createHmac("sha256", token).update(`v1.${exp}`).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sessionCookie(request: Request, token: string): string {
  const exp = String(Date.now() + SESSION_MAX_AGE_SEC * 1000);
  const value = `v1.${exp}.${sessionMac(token, exp)}`;
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, "Path=/owner/stats", "HttpOnly", "SameSite=Strict", `Max-Age=${SESSION_MAX_AGE_SEC}`];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

function clearSessionCookie(request: Request): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/owner/stats", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

function sessionValid(value: string | null, token: string | undefined, now = Date.now()): boolean {
  if (!value || !token) return false;
  const [version, exp, mac] = value.split(".");
  if (version !== "v1" || !exp || !mac || value.split(".").length !== 3) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires <= now) return false;
  return sameText(mac, sessionMac(token, exp));
}

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

const html = (body: string, status = 200, extraHeaders: HeadersInit = {}) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Owner stats</title><style>body{font-family:system-ui,sans-serif;background:#111;color:#f5efe6;max-width:28rem;margin:2rem auto;padding:0 1rem}dl{display:grid;grid-template-columns:1fr auto;gap:.75rem 1rem;font-size:1.25rem}dd{margin:0;font-weight:700;text-align:right}small,label{color:#a89f94}input{width:100%;box-sizing:border-box;margin:.5rem 0 1rem;padding:.6rem;border-radius:.4rem;border:1px solid #444;background:#1b1b1b;color:inherit}button{padding:.6rem 1rem;border-radius:.4rem;border:0;background:#c4553a;color:#fff}</style></head><body>${body}</body></html>`,
    { status, headers: { ...baseHeaders, "Content-Type": "text/html; charset=utf-8", ...extraHeaders } },
  );

const loginForm = (message = "") =>
  `<h1>Owner stats</h1>${message ? `<p>${message}</p>` : ""}<form method="post" action="/owner/stats" autocomplete="off"><label>Key<input type="password" name="token" autocomplete="current-password" required></label><button type="submit">Show stats</button></form>`;

async function statsHtml(count: Counter): Promise<Response> {
  if (!isStorageConfigured()) return html("<h1>Owner stats</h1><p>Storage is not configured.</p>", 503);
  try {
    const s = await loadOwnerStats(count);
    const n = (v: number) => v.toLocaleString("en-US");
    return html(
      `<h1>Smash Collab members</h1><dl><dt>Total members</dt><dd>${n(s.totalMembers)}</dd><dt>Signed up today</dt><dd>${n(s.signupsToday)}</dd><dt>Last 24 hours</dt><dd>${n(s.signupsLast24h)}</dd><dt>Last 7 days</dt><dd>${n(s.signupsLast7d)}</dd></dl><p><small>"Today" starts at midnight New York time. Refresh for the latest numbers.</small></p><form method="post" action="/owner/stats"><button type="submit" name="lock" value="1">Lock this browser</button></form>`,
    );
  } catch {
    return html("<h1>Owner stats</h1><p>Could not load stats right now.</p>", 503);
  }
}

async function postedToken(request: Request): Promise<{ token: string | null; lock: boolean }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown; lock?: unknown } | null;
    return { token: typeof body?.token === "string" ? body.token : null, lock: body?.lock === true || body?.lock === "1" };
  }
  const text = await request.text();
  const params = new URLSearchParams(text);
  return { token: params.get("token"), lock: params.get("lock") === "1" };
}

/**
 * HTML page. GET shows a form, or the counts when this browser has a valid session cookie.
 * POST accepts the token in the body (never the query string) and sets an HttpOnly cookie
 * that does not contain the token. `?key=` is ignored.
 */
export async function handleOwnerStatsPage(request: Request, count: Counter = defaultCounter): Promise<Response> {
  if (!ownerStatsEnabled()) return notFound();
  const expected = process.env.OWNER_STATS_TOKEN;
  if (request.method === "POST") {
    const posted = await postedToken(request);
    if (posted.lock) {
      return html(loginForm(), 200, { "Set-Cookie": clearSessionCookie(request) });
    }
    if (!tokenMatches(posted.token, expected)) {
      if (tooManyFailures(clientIp(request))) {
        return html(loginForm("Too many tries. Wait a few minutes and try again."), 429);
      }
      return html(loginForm("That key did not match."), 401);
    }
    const headers = new Headers({
      ...baseHeaders,
      Location: "/owner/stats",
      "Set-Cookie": sessionCookie(request, expected ?? ""),
    });
    return new Response(null, { status: 303, headers });
  }
  if (sessionValid(readCookie(request, SESSION_COOKIE), expected)) return statsHtml(count);
  return html(loginForm());
}
