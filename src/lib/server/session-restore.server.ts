/**
 * POST /api/auth/restore  ("Continue as @channel")
 *
 * Restores a creator's YouTube-verified session after a plain Google/Firebase
 * sign-in, so a returning creator does not have to repeat the YouTube channel
 * verification every time they log out and back in.
 *
 * Security model:
 *   - The caller proves who they are with a fresh Firebase ID token
 *     (Authorization: Bearer ...), verified server-side against Google's keys.
 *     The token must come from a sign-in in the last few minutes.
 *   - The channel comes ONLY from server-trusted Firestore data: the profile's
 *     server-written `verifiedChannelId` (rules forbid the browser to write it)
 *     AND the server-only `channels/{channelId}` record, which must be linked
 *     back to the same Firebase uid. Nothing in the request body is read.
 *   - Only then are the signed `yt_account` session cookie and the Plus cookie
 *     re-issued, exactly as a YouTube verification would.
 *   - No verified channel on file -> 404 needsVerify: do the full YouTube verify.
 */
import { requestFirebaseUser, type FirebaseIdentity } from "@/lib/server/firebase-auth.server";
import { getDocument, isStorageConfigured } from "@/lib/server/firestore.server";
import { readChannelRecord, syncPublicPlus, userPath } from "@/lib/server/public-profile.server";
import { rateLimited } from "@/lib/server/custom-token.server";
import { getRequestOrigin } from "@/lib/youtube/config";
import {
  buildYtAccountCookie,
  plusCookieFor,
  resolvePlus,
  signYtAccount,
  type YtAccount,
} from "@/lib/youtube/plus-entitlement";

/** The Firebase sign-in behind the ID token must be this recent. */
export const RESTORE_MAX_AUTH_AGE_SEC = 15 * 60;

const NEEDS_VERIFY = "Verify your YouTube channel to finish signing in.";

export type RestoreResponse =
  | { restored: true; channelId: string; channel: string | null; premium: boolean; premiumUntil: number | null }
  | { error: string; needsVerify: boolean };

function json(body: RestoreResponse, status: number, cookies: string[] = []): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

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

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** The caller's email, only if Google verified it (email_verified or a Google sign-in). */
export function trustedEmail(identity: FirebaseIdentity): string | null {
  if (!identity.email) return null;
  if (identity.emailVerified || identity.signInProvider === "google.com") return identity.email.toLowerCase();
  return null;
}

/**
 * The YouTube identity linked to this Firebase user, from server-trusted
 * storage only, or null when the creator has to verify via YouTube.
 */
export async function linkedAccountFor(identity: FirebaseIdentity): Promise<YtAccount | null> {
  const profile = await getDocument(userPath(identity.uid));
  const channelId = typeof profile?.verifiedChannelId === "string" ? profile.verifiedChannelId : "";
  if (!channelId) return null;
  const record = await readChannelRecord(channelId);
  // The channel must still be linked to this uid (a channel can move to another account).
  if (!record || record.uid !== identity.uid) return null;
  // Same rule as linking: the YouTube grant and the Firebase account are the same Google account.
  // Only a Google-verified email counts; an unverified one never matches.
  const trusted = trustedEmail(identity);
  if (record.email && trusted !== record.email.toLowerCase()) return null;
  const email = record.email ?? trusted;
  return { channelId, channel: record.channel, email };
}

export async function handleRestoreRequest(request: Request): Promise<Response> {
  if (crossSite(request)) return json({ error: "Forbidden.", needsVerify: false }, 403);

  const identity = await requestFirebaseUser(request);
  if (!identity) return json({ error: "Sign in with Google again.", needsVerify: false }, 401);
  if (!identity.authTime || Date.now() / 1000 - identity.authTime > RESTORE_MAX_AUTH_AGE_SEC) {
    return json({ error: "Sign in with Google again.", needsVerify: false }, 401);
  }

  // Own buckets (restore-ip:/restore-uid:), separate from the custom-token route's ip:/ch: keys;
  // only the in-memory limiter helper is reused.
  if (rateLimited(`restore-ip:${clientIp(request)}`) || rateLimited(`restore-uid:${identity.uid}`)) {
    return json({ error: "Too many sign-in attempts. Wait a few minutes and try again.", needsVerify: false }, 429);
  }
  if (!isStorageConfigured()) {
    return json({ error: "Sign-in restore is not configured on the server.", needsVerify: false }, 503);
  }

  try {
    const account = await linkedAccountFor(identity);
    if (!account) return json({ error: NEEDS_VERIFY, needsVerify: true }, 404);
    const plus = await resolvePlus(request, account);
    if (plus.storage === "ok") await syncPublicPlus(account.channelId, plus);
    const cookies = [buildYtAccountCookie(request, await signYtAccount(account.channelId, account.channel, account.email))];
    const plusCookie = await plusCookieFor(request, account, plus);
    if (plusCookie) cookies.push(plusCookie);
    return json(
      {
        restored: true,
        channelId: account.channelId,
        channel: account.channel,
        premium: plus.premium,
        premiumUntil: plus.premiumUntil,
      },
      200,
      cookies,
    );
  } catch {
    return json({ error: "Could not restore your sign-in right now. Try again.", needsVerify: false }, 503);
  }
}
