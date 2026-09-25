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
  | "unknown";

export function buildGoogleAuthUrl(request: Request, state: string): string | null {
  const clientId = getGoogleClientId();
  if (!clientId) return null;
  const redirectUri = getYouTubeRedirectUri(request);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
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

type YouTubeChannelsResponse = {
  items?: Array<{
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
  }>;
  error?: { message?: string };
};

async function fetchGoogleDisplayName(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;
  } catch {
    return null;
  }
}

export async function fetchVerifiedChannel(
  accessToken: string,
): Promise<VerifiedYouTubeChannel | { reason: YouTubeOAuthErrorReason }> {
  const url = new URL(YOUTUBE_CHANNELS);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("mine", "true");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as YouTubeChannelsResponse;
  if (!res.ok) {
    return { reason: "api" };
  }

  const item = data.items?.[0];
  const channelId = typeof item?.id === "string" ? item.id.trim() : "";
  if (!item?.snippet?.title || !channelId) {
    return { reason: "no_channel" };
  }

  const subscribers = Number.parseInt(item.statistics?.subscriberCount ?? "0", 10) || 0;
  const viewCount = Number.parseInt(item.statistics?.viewCount ?? "0", 10) || 0;
  const videoCount = Number.parseInt(item.statistics?.videoCount ?? "0", 10) || 0;
  const avgViews = Math.floor(viewCount / Math.max(1, videoCount));

  const thumb =
    item.snippet.thumbnails?.high?.url ??
    item.snippet.thumbnails?.medium?.url ??
    item.snippet.thumbnails?.default?.url ??
    null;

  const channelTitle = item.snippet.title.trim();
  const custom = item.snippet.customUrl?.trim();
  const googleName = await fetchGoogleDisplayName(accessToken);

  return {
    channelId,
    displayName: googleName || channelTitle,
    channel: custom ? (custom.startsWith("@") ? custom : `@${custom}`) : channelTitle,
    subscribers,
    avgViews,
    avatar: thumb,
  };
}

export function errorHomeRedirect(home: string, reason: YouTubeOAuthErrorReason): Response {
  const url = new URL(home);
  url.searchParams.set("yt", "error");
  url.searchParams.set("reason", reason);
  return Response.redirect(url.toString(), 302);
}
