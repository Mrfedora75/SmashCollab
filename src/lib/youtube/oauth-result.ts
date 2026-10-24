import { isStorageConfigured } from "@/lib/server/firestore.server";
import { recordVerifiedChannel } from "@/lib/server/public-profile.server";
import { buildYtAccountCookie, signYtAccount } from "@/lib/youtube/plus-entitlement";
import {
  errorHomeRedirect,
  fetchVerifiedChannel,
  type YouTubeOAuthErrorReason,
} from "@/lib/youtube/oauth";
import {
  buildCookie,
  clearCookie,
  openPendingYouTubeAuth,
  parseCookieHeader,
  sealPendingYouTubeAuth,
  signVerifiedChannel,
  YT_ACCESS_COOKIE,
  YT_ACCESS_MAX_AGE_SEC,
  YT_CHANNEL_COOKIE,
  YT_ID_TOKEN_COOKIE,
  YT_STATE_COOKIE,
  type VerifiedYouTubeChannel,
} from "@/lib/youtube/session";

export type YouTubeGrant = {
  accessToken: string;
  idToken: string | null;
};

function redirectOk(home: string, setCookies: string[]): Response {
  const url = new URL(home);
  url.searchParams.set("yt", "ok");
  const headers = new Headers({ Location: url.toString() });
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export function redirectOAuthError(
  request: Request,
  home: string,
  reason: YouTubeOAuthErrorReason,
  extraCookies: string[] = [],
): Response {
  const response = errorHomeRedirect(home, reason);
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", clearCookie(request, YT_STATE_COOKIE));
  // Cancelling Google should drop a token saved for a previous attempt.
  if (reason === "denied") {
    headers.append("Set-Cookie", clearCookie(request, YT_ACCESS_COOKIE));
  }
  for (const cookie of extraCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

async function successCookies(
  request: Request,
  channel: VerifiedYouTubeChannel,
  idToken: string | null,
): Promise<string[]> {
  if (isStorageConfigured()) {
    try {
      await recordVerifiedChannel(channel);
    } catch {
      // Non-fatal: sign-in still works; collabs to this channel stay limited until it re-verifies.
    }
  }
  const signedChannel = await signVerifiedChannel(channel);
  const signedAccount = await signYtAccount(channel.channelId, channel.channel, channel.email);
  const setCookies = [
    clearCookie(request, YT_STATE_COOKIE),
    clearCookie(request, YT_ACCESS_COOKIE),
    buildCookie(request, YT_CHANNEL_COOKIE, signedChannel, 600),
    buildYtAccountCookie(request, signedAccount),
  ];
  if (idToken) {
    setCookies.push(buildCookie(request, YT_ID_TOKEN_COOKIE, idToken, 600));
  }
  return setCookies;
}

/**
 * Exchange is done. Read the channel, and if YouTube does not answer, keep the
 * access token in a short-lived encrypted cookie so the creator can retry the
 * read without another Google consent.
 */
export async function completeYouTubeGrant(
  request: Request,
  home: string,
  grant: YouTubeGrant,
  deps?: { fetchChannel?: typeof fetchVerifiedChannel },
): Promise<Response> {
  const fetchChannel = deps?.fetchChannel ?? fetchVerifiedChannel;
  let channelResult: VerifiedYouTubeChannel | { reason: YouTubeOAuthErrorReason };
  try {
    channelResult = await fetchChannel(grant.accessToken);
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.warn(`[youtube] channel lookup threw error=${name}`);
    channelResult = { reason: "api" };
  }

  if ("reason" in channelResult) {
    const sealed = await sealPendingYouTubeAuth({ accessToken: grant.accessToken });
    const cookies = [
      buildCookie(request, YT_ACCESS_COOKIE, sealed, YT_ACCESS_MAX_AGE_SEC),
    ];
    if (grant.idToken) {
      cookies.push(buildCookie(request, YT_ID_TOKEN_COOKIE, grant.idToken, 600));
    }
    return redirectOAuthError(request, home, channelResult.reason, cookies);
  }

  return redirectOk(home, await successCookies(request, channelResult, grant.idToken));
}

/** Retry the channel read with the token saved after a failed sign-in. */
export async function resumeYouTubeGrant(
  request: Request,
  home: string,
  deps?: { fetchChannel?: typeof fetchVerifiedChannel },
): Promise<Response> {
  const cookies = parseCookieHeader(request);
  const pending = await openPendingYouTubeAuth(cookies[YT_ACCESS_COOKIE]);
  if (!pending) {
    return redirectOAuthError(request, home, "retry");
  }
  const idToken = cookies[YT_ID_TOKEN_COOKIE] ?? null;
  return completeYouTubeGrant(request, home, { accessToken: pending.accessToken, idToken }, deps);
}
