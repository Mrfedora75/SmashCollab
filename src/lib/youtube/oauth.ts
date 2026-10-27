import {
  getGoogleClientId,
  getGoogleClientSecret,
  getYouTubeRedirectUri,
  YOUTUBE_SCOPES,
} from "./config";
import type { VerifiedYouTubeChannel } from "./session";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS = "https://www.googleapis.com/youtube/v3/channels";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export type YouTubeOAuthErrorReason =
  | "config"
  | "denied"
  | "state"
  | "token"
  | "no_channel"
  | "api"
  | "retry"
  | "unknown";

/**
 * Delays between channel-list attempts. The first call happens immediately;
 * these are the waits after a retryable failure (about 3.1s total).
 */
export const YOUTUBE_CHANNEL_RETRY_DELAYS_MS = [400, 900, 1800];

const CHANNEL_ATTEMPTS = YOUTUBE_CHANNEL_RETRY_DELAYS_MS.length + 1;

/** Statuses YouTube/Google document as transient, plus 401 while a new token propagates. */
const RETRYABLE_STATUS = new Set([401, 408, 429, 500, 502, 503, 504]);

/**
 * Failures that will not succeed by calling again with the same token.
 * `quotaExceeded` is included so a retry does not spend more quota.
 */
const PERMANENT_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "accessNotConfigured",
  "insufficientPermissions",
  "accountClosed",
  "authenticatedUserAccountClosed",
  "authenticatedUserAccountSuspended",
  "ipRefererBlocked",
]);

/**
 * A statistics-inclusive `channels.list` can be rejected while `part=snippet`
 * still returns the channel. Identity is enough to finish sign-in.
 */
const SNIPPET_FALLBACK_REASONS = new Set([
  "forbidden",
  "channelForbidden",
  "invalidPart",
  "unexpectedPart",
  "unknownPart",
]);

export function buildGoogleAuthUrl(request: Request, state: string): string | null {
  const clientId = getGoogleClientId();
  if (!clientId) return null;
  const redirectUri = getYouTubeRedirectUri(request);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  // Online access only. Sign-in uses a short-lived access token and never stores a refresh token.
  // select_account: always let the creator pick which Google account / channel to verify.
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForTokens(
  request: Request,
  code: string,
): Promise<{ accessToken: string; idToken: string | null } | { reason: YouTubeOAuthErrorReason }> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) return { reason: "config" };

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getYouTubeRedirectUri(request),
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    return { reason: "token" };
  }
  return { accessToken: data.access_token, idToken: data.id_token ?? null };
}

type ChannelItem = {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
};

type YouTubeChannelsResponse = {
  items?: ChannelItem[];
  error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
};

export type ChannelFetchDeps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function youtubeErrorReason(data: YouTubeChannelsResponse | null): string | null {
  const reason = data?.error?.errors?.find((item) => typeof item.reason === "string")?.reason;
  return reason ?? null;
}

const RETRYABLE_403 = new Set([
  "forbidden",
  "channelForbidden",
  "backendError",
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "youtubeSignupRequired",
]);

/** True when another call with the same token can still succeed. */
export function isRetryableYouTubeFailure(status: number, reason: string | null): boolean {
  if (reason && PERMANENT_REASONS.has(reason)) return false;
  if (RETRYABLE_STATUS.has(status)) return true;
  // 403: rate limits, backend errors, and a fresh token YouTube is not ready to honor yet.
  if (status === 403 && (!reason || RETRYABLE_403.has(reason))) return true;
  // Brand-account lag is sometimes reported as 401 youtubeSignupRequired (401 is already retryable).
  if (reason === "youtubeSignupRequired") return true;
  return false;
}

function shouldFallbackToSnippet(status: number, reason: string | null): boolean {
  if (status === 400) return true;
  return Boolean(reason && SNIPPET_FALLBACK_REASONS.has(reason));
}

function parseDigits(value: string | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStatistics(statistics: ChannelItem["statistics"]): {
  subscribers: number;
  avgViews: number;
  subscribersKnown: boolean;
  subscribersHidden: boolean;
  statisticsAvailable: boolean;
} {
  if (!statistics) {
    return { subscribers: 0, avgViews: 0, subscribersKnown: false, subscribersHidden: false, statisticsAvailable: false };
  }
  const hidden = statistics.hiddenSubscriberCount === true;
  const subs = parseDigits(statistics.subscriberCount);
  const views = parseDigits(statistics.viewCount);
  const videos = parseDigits(statistics.videoCount);
  const avgViews = views == null ? 0 : Math.floor(views / Math.max(1, videos ?? 0));
  // A hidden count is often reported as "0". That placeholder is not a real subscriber count.
  // A positive count alongside the flag is the owner's own figure; keep it for their card only.
  if (hidden) {
    const known = subs != null && subs > 0;
    return {
      subscribers: known ? subs : 0,
      avgViews,
      subscribersKnown: known,
      subscribersHidden: true,
      statisticsAvailable: true,
    };
  }
  if (subs == null) {
    return { subscribers: 0, avgViews, subscribersKnown: false, subscribersHidden: false, statisticsAvailable: true };
  }
  return { subscribers: subs, avgViews, subscribersKnown: true, subscribersHidden: false, statisticsAvailable: true };
}

async function fetchGoogleUser(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<{ name: string | null; email: string | null }> {
  try {
    const res = await fetchImpl(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { name: null, email: null };
    const data = (await res.json()) as { name?: string; email?: string; email_verified?: boolean };
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;
    // Only a Google-verified email is trusted (used for the tester Plus allowlist).
    const email =
      data.email_verified === true && typeof data.email === "string" && data.email.includes("@")
        ? data.email.trim().toLowerCase()
        : null;
    return { name, email };
  } catch {
    return { name: null, email: null };
  }
}

function pickChannel(items: ChannelItem[] | undefined): ChannelItem | null {
  const usable = (items ?? []).filter((item) => {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const title = item?.snippet?.title?.trim();
    return Boolean(id && title);
  });
  if (usable.length === 0) return null;
  return usable.find((item) => item.snippet?.customUrl?.trim()) ?? usable[0];
}

type ListAttempt =
  | { ok: true; item: ChannelItem }
  | { ok: false; reason: "no_channel" }
  | { ok: false; reason: "api"; fallbackToSnippet: boolean };

async function readChannelBody(res: Response): Promise<YouTubeChannelsResponse | null> {
  try {
    return (await res.json()) as YouTubeChannelsResponse;
  } catch {
    return null;
  }
}

/**
 * One `channels.list?mine=true` sequence. Empty `items` and transient non-2xx
 * responses are retried: both show up on the first call right after the token
 * exchange (auth propagation, and brand-account channel linkage) and then succeed.
 */
async function fetchChannelList(
  accessToken: string,
  part: string,
  deps: ChannelFetchDeps,
): Promise<ListAttempt> {
  const fetchImpl = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  let fallbackToSnippet = false;

  for (let attempt = 0; attempt < CHANNEL_ATTEMPTS; attempt += 1) {
    const url = new URL(YOUTUBE_CHANNELS);
    url.searchParams.set("part", part);
    url.searchParams.set("mine", "true");

    let res: Response;
    try {
      res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error) {
      const message = error instanceof Error ? error.name : "Error";
      console.warn(`[youtube] channels.list network error attempt=${attempt + 1} part=${part} error=${message}`);
      if (attempt < CHANNEL_ATTEMPTS - 1) {
        await sleep(YOUTUBE_CHANNEL_RETRY_DELAYS_MS[attempt] ?? 1800);
        continue;
      }
      return { ok: false, reason: "api", fallbackToSnippet };
    }

    const data = await readChannelBody(res);
    const reason = youtubeErrorReason(data);
    if (res.ok && data) {
      const item = pickChannel(data.items);
      if (item) return { ok: true, item };
      console.warn(`[youtube] channels.list empty items attempt=${attempt + 1} part=${part}`);
      if (attempt < CHANNEL_ATTEMPTS - 1) {
        await sleep(YOUTUBE_CHANNEL_RETRY_DELAYS_MS[attempt] ?? 1800);
        continue;
      }
      return { ok: false, reason: "no_channel" };
    }

    console.warn(
      `[youtube] channels.list failed status=${res.status} reason=${reason ?? "unknown"} attempt=${attempt + 1} part=${part}`,
    );
    if (shouldFallbackToSnippet(res.status, reason)) fallbackToSnippet = true;
    const retry = !data && !res.ok ? RETRYABLE_STATUS.has(res.status) || res.status >= 500 : isRetryableYouTubeFailure(res.status, reason);
    // A non-JSON 2xx body is a truncated response, not a permanent rejection.
    const retryable = res.ok ? !data : retry;
    if (retryable && attempt < CHANNEL_ATTEMPTS - 1) {
      await sleep(YOUTUBE_CHANNEL_RETRY_DELAYS_MS[attempt] ?? 1800);
      continue;
    }
    if (res.ok) return { ok: false, reason: "api", fallbackToSnippet };
    return { ok: false, reason: "api", fallbackToSnippet };
  }

  return { ok: false, reason: "api", fallbackToSnippet };
}

async function channelFromItem(
  accessToken: string,
  item: ChannelItem,
  fetchImpl: typeof fetch,
): Promise<VerifiedYouTubeChannel> {
  const channelId = item.id!.trim();
  const channelTitle = item.snippet!.title!.trim();
  const stats = readStatistics(item.statistics);
  const thumb =
    item.snippet?.thumbnails?.high?.url ??
    item.snippet?.thumbnails?.medium?.url ??
    item.snippet?.thumbnails?.default?.url ??
    null;
  const custom = item.snippet?.customUrl?.trim();
  const google = await fetchGoogleUser(accessToken, fetchImpl);
  return {
    channelId,
    displayName: google.name || channelTitle,
    channel: custom ? (custom.startsWith("@") ? custom : `@${custom}`) : channelTitle,
    subscribers: stats.subscribers,
    avgViews: stats.avgViews,
    avatar: thumb,
    email: google.email,
    subscribersHidden: stats.subscribersHidden,
    subscribersKnown: stats.subscribersKnown,
    statisticsAvailable: stats.statisticsAvailable,
  };
}

/**
 * Read the channel the creator just authorized.
 *
 * The request already includes `part=snippet,statistics`. A first call can still
 * fail closed: YouTube often answers 401 `authError` or 403 `youtubeSignupRequired`
 * for a second or two after the token exchange (the token or the brand-account
 * channel link has not propagated), or 429/5xx. Those are retried here. A 200
 * with no `items` is the same lag and is retried before it is reported as
 * `no_channel`. Missing or hidden statistics do not fail sign-in.
 */
export async function fetchVerifiedChannel(
  accessToken: string,
  deps: ChannelFetchDeps = {},
): Promise<VerifiedYouTubeChannel | { reason: YouTubeOAuthErrorReason }> {
  const fetchImpl = deps.fetch ?? fetch;
  const full = await fetchChannelList(accessToken, "snippet,statistics", deps);
  if (full.ok) return channelFromItem(accessToken, full.item, fetchImpl);
  if (full.reason === "no_channel") return { reason: "no_channel" };
  if (full.fallbackToSnippet) {
    const snippet = await fetchChannelList(accessToken, "snippet", deps);
    if (snippet.ok) return channelFromItem(accessToken, snippet.item, fetchImpl);
    if (snippet.reason === "no_channel") return { reason: "no_channel" };
  }
  return { reason: "api" };
}

export function errorHomeRedirect(home: string, reason: YouTubeOAuthErrorReason): Response {
  const url = new URL(home);
  url.searchParams.set("yt", "error");
  url.searchParams.set("reason", reason);
  return Response.redirect(url.toString(), 302);
}
