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

function normalizeHost(value: string | null | undefined): string | null {
  const host = value?.split(",")[0]?.trim().toLowerCase();
  return host ? host : null;
}

/** Hosts this deployment is allowed to treat as itself. A client-supplied forwarded host is not enough. */
function allowedHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    const host = normalizeHost(value);
    if (host) hosts.add(host);
  };
  add(request.headers.get("host"));
  try {
    add(new URL(request.url).host);
  } catch {
    // Ignore a malformed request URL and keep the other allowlist entries.
  }
  add(env("VERCEL_URL")?.replace(/^https?:\/\//, ""));
  for (const key of ["GOOGLE_REDIRECT_URI", "APP_ORIGIN"]) {
    const raw = env(key);
    if (!raw) continue;
    try {
      add(new URL(raw).host);
    } catch {
      // Ignore a malformed configured origin.
    }
  }
  return hosts;
}

/**
 * Public site origin for redirects (preview / production / local).
 * `X-Forwarded-Host` is used only when it matches the Host header, the request URL,
 * `VERCEL_URL`, `GOOGLE_REDIRECT_URI`, or `APP_ORIGIN`. Otherwise it is ignored.
 */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const allowed = allowedHosts(request);
  const forwarded = normalizeHost(request.headers.get("x-forwarded-host"));
  const hostHeader = normalizeHost(request.headers.get("host"));
  const forwardedOk = Boolean(forwarded && allowed.has(forwarded));
  const protoHeader = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const proto =
    forwardedOk && (protoHeader === "http" || protoHeader === "https")
      ? protoHeader
      : env("VERCEL") || env("VERCEL_ENV")
        ? "https"
        : url.protocol.replace(":", "");
  if (forwardedOk && forwarded) return `${proto}://${forwarded}`;
  if (hostHeader && allowed.has(hostHeader)) return `${proto}://${hostHeader}`;
  return url.origin;
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
