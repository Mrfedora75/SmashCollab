import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env.server";
import { getGoogleClientSecret, isSecureRequest } from "./config";

export const YT_STATE_COOKIE = "yt_oauth_state";
export const YT_CHANNEL_COOKIE = "yt_verified_channel";

export type VerifiedYouTubeChannel = {
  displayName: string;
  channel: string;
  subscribers: number;
  avgViews: number;
  avatar: string | null;
};

function signingKey(): Uint8Array {
  const secret =
    getGoogleClientSecret() ??
    env("BETTER_AUTH_SECRET") ??
    "smashcollab-youtube-dev-secret";
  return new TextEncoder().encode(secret);
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
    displayName: channel.displayName,
    channel: channel.channel,
    subscribers: channel.subscribers,
    avgViews: channel.avgViews,
    avatar: channel.avatar,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(signingKey());
}

export async function readVerifiedChannel(
  token: string | undefined,
): Promise<VerifiedYouTubeChannel | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    const displayName = typeof payload.displayName === "string" ? payload.displayName : "";
    const channel = typeof payload.channel === "string" ? payload.channel : "";
    const subscribers =
      typeof payload.subscribers === "number" ? payload.subscribers : Number(payload.subscribers);
    const avgViews =
      typeof payload.avgViews === "number" ? payload.avgViews : Number(payload.avgViews);
    const avatar =
      typeof payload.avatar === "string" && payload.avatar.length > 0 ? payload.avatar : null;
    if (!channel || !Number.isFinite(subscribers)) return null;
    return {
      displayName: displayName || channel,
      channel,
      subscribers: Math.max(0, Math.floor(subscribers)),
      avgViews: Number.isFinite(avgViews) ? Math.max(0, Math.floor(avgViews)) : 0,
      avatar,
    };
  } catch {
    return null;
  }
}
