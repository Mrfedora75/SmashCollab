/**
 * POST /api/firebase/custom-token
 *
 * Restores a creator's Firebase Auth session without a new Google prompt.
 * The long-lived, HttpOnly, HS256-signed `yt_account` cookie (set by the
 * YouTube OAuth callback) proves which channel this browser verified; the
 * server-only `channels/{channelId}` record says which Firebase uid that
 * channel is linked to (written by /api/profile/sync after the first
 * Firebase sign-in). We then mint a one-hour Firebase custom token for that
 * uid, signed with FIREBASE_SERVICE_ACCOUNT. The browser exchanges it with
 * signInWithCustomToken, and Firebase keeps the session alive from there.
 *
 * Responses never include anything but the custom token itself, and nothing
 * here is logged.
 */
import { isStorageConfigured, signFirebaseCustomToken, getDocument } from "@/lib/server/firestore.server";
import { readChannelRecord, userPath } from "@/lib/server/public-profile.server";
import { readYtAccount, YT_ACCOUNT_COOKIE } from "@/lib/youtube/plus-entitlement";
import { parseCookieHeader } from "@/lib/youtube/session";
import { getRequestOrigin } from "@/lib/youtube/config";

export type CustomTokenResponse =
  | { token: string }
  | { error: string; needsVerify: boolean };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; reset: number }>();

/** Best-effort per-instance limiter (serverless instances do not share memory). */
export function rateLimited(key: string, now = Date.now()): boolean {
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Tests only. */
export function resetRateLimitForTests(): void {
  hits.clear();
}

function json(body: CustomTokenResponse, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Same-origin browser requests only (the cookie is SameSite=Lax, this is defence in depth). */
function crossSite(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(getRequestOrigin(request)).host;
  } catch {
    return true;
  }
}

const NEEDS_VERIFY = "Verify via YouTube to sign in on this device.";

export async function handleCustomTokenRequest(request: Request): Promise<Response> {
  if (crossSite(request)) return json({ error: "Forbidden.", needsVerify: false }, 403);

  const account = await readYtAccount(parseCookieHeader(request)[YT_ACCOUNT_COOKIE]);
  if (!account) return json({ error: NEEDS_VERIFY, needsVerify: true }, 401);

  if (rateLimited(`ip:${clientIp(request)}`) || rateLimited(`ch:${account.channelId}`)) {
    return json({ error: "Too many sign-in attempts. Wait a few minutes and try again.", needsVerify: false }, 429);
  }

  if (!isStorageConfigured()) {
    return json({ error: "Sign-in restore is not configured on the server.", needsVerify: false }, 503);
  }

  try {
    const record = await readChannelRecord(account.channelId);
    const uid = record?.uid ?? null;
    if (!uid) return json({ error: NEEDS_VERIFY, needsVerify: true }, 404);
    // The profile must still be linked to this channel (a channel can move to another account).
    const profile = await getDocument(userPath(uid));
    if (!profile || profile.verifiedChannelId !== account.channelId) {
      return json({ error: NEEDS_VERIFY, needsVerify: true }, 404);
    }
    const token = await signFirebaseCustomToken(uid);
    return json({ token }, 200);
  } catch {
    return json({ error: "Could not restore your sign-in right now. Try again.", needsVerify: false }, 503);
  }
}
