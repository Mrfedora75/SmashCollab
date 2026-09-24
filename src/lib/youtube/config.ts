import { env } from "@/lib/env.server";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "openid",
  "email",
  "profile",
].join(" ");

export function getGoogleClientId(): string | undefined {
  return env("GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret(): string | undefined {
  return env("GOOGLE_CLIENT_SECRET");
}

export function isYouTubeConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

/** Public site origin for redirects (preview / production / local). */
export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`.replace(/\/$/, "");
  }

  const betterAuth = env("BETTER_AUTH_URL");
  if (betterAuth) return betterAuth.replace(/\/$/, "");

  const vercel = env("VERCEL_URL");
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return new URL(request.url).origin;
}

export function getYouTubeRedirectUri(request: Request): string {
  const explicit = env("GOOGLE_REDIRECT_URI");
  if (explicit) return explicit;
  return `${getRequestOrigin(request)}/api/youtube/callback`;
}

export function getAppHomeUrl(request: Request): string {
  const explicit = env("GOOGLE_REDIRECT_URI");
  if (explicit) {
    try {
      return `${new URL(explicit).origin}/`;
    } catch {
      // Ignore a malformed override and fall back to the request host.
    }
  }
  return `${getRequestOrigin(request)}/`;
}

export function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return new URL(request.url).protocol === "https:";
}
