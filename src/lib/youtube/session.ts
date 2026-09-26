import { SignJWT, jwtVerify } from "jose";
import { env, isDeployed } from "@/lib/env.server";
import { getGoogleClientSecret, isSecureRequest } from "./config";

export const YT_STATE_COOKIE = "yt_oauth_state";
export const YT_CHANNEL_COOKIE = "yt_verified_channel";
export const YT_ID_TOKEN_COOKIE = "yt_google_id";

export type VerifiedYouTubeChannel = {
  channelId: string;
  displayName: string;
  channel: string;
  subscribers: number;
  avgViews: number;
  avatar: string | null;
  /** Google-verified email of the account that authorized, if any. */
  email: string | null;
  /** True when the channel hides its subscriber count (only set right after the YouTube API read). */
  subscribersHidden?: boolean;
};

/**
 * Key for the YouTube session cookies (state, verified channel, account).
 * Deployed builds never fall back to a hard-coded secret: a missing secret
 * fails closed instead of issuing forgeable cookies.
 */
export function getYoutubeSigningKey(): Uint8Array {
  const secret = getGoogleClientSecret() ?? (isDeployed() ? undefined : "smashcollab-youtube-dev-secret");
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not configured.");
  return new TextEncoder().encode(secret);
}

/**
 * Keys that can verify the `matchcut_plus` cookie, newest first. New cookies
 * are signed with PLUS_COOKIE_SECRET; the YouTube key is a temporary fallback
 * so cookies issued before the switch keep working (and is used for signing
 * only until PLUS_COOKIE_SECRET is set).
 */
export function getPlusCookieKeys(): Uint8Array[] {
  const keys: Uint8Array[] = [];
  const dedicated = env("PLUS_COOKIE_SECRET");
  if (dedicated) keys.push(new TextEncoder().encode(dedicated));
  try {
    keys.push(getYoutubeSigningKey());
  } catch {
    // no fallback key available
  }
  if (keys.length === 0) throw new Error("PLUS_COOKIE_SECRET is not configured.");
  return keys;
}

export function parseCookieHeader(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") ?? "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function baseCookieFlags(request: Request, maxAge: number): string {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export function buildCookie(
  request: Request,
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return `${name}=${encodeURIComponent(value)}; ${baseCookieFlags(request, maxAgeSeconds)}`;
}

export function clearCookie(request: Request, name: string): string {
  return `${name}=; ${baseCookieFlags(request, 0)}`;
}

export function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signVerifiedChannel(
  channel: VerifiedYouTubeChannel,
): Promise<string> {
  return new SignJWT({
    channelId: channel.channelId,
    displayName: channel.displayName,
    channel: channel.channel,
    subscribers: channel.subscribers,
    avgViews: channel.avgViews,
    avatar: channel.avatar,
    email: channel.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getYoutubeSigningKey());
}

export async function readVerifiedChannel(
  token: string | undefined,
): Promise<VerifiedYouTubeChannel | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getYoutubeSigningKey());
    const channelId = typeof payload.channelId === "string" ? payload.channelId : "";
    const displayName = typeof payload.displayName === "string" ? payload.displayName : "";
    const channel = typeof payload.channel === "string" ? payload.channel : "";
    const subscribers =
      typeof payload.subscribers === "number" ? payload.subscribers : Number(payload.subscribers);
    const avgViews =
      typeof payload.avgViews === "number" ? payload.avgViews : Number(payload.avgViews);
    const avatar =
      typeof payload.avatar === "string" && payload.avatar.length > 0 ? payload.avatar : null;
    if (!channelId || !channel || !Number.isFinite(subscribers)) return null;
    return {
      channelId,
      displayName: displayName || channel,
      channel,
      subscribers: Math.max(0, Math.floor(subscribers)),
      avgViews: Number.isFinite(avgViews) ? Math.max(0, Math.floor(avgViews)) : 0,
      avatar,
      email: typeof payload.email === "string" && payload.email ? payload.email : null,
    };
  } catch {
    return null;
  }
}
