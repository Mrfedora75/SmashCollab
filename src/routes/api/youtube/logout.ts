import { createFileRoute } from "@tanstack/react-router";
import { clearPlusCookie, clearYtAccountCookie } from "@/lib/youtube/plus-entitlement";
import {
  clearCookie,
  YT_CHANNEL_COOKIE,
  YT_ID_TOKEN_COOKIE,
  YT_STATE_COOKIE,
} from "@/lib/youtube/session";

/**
 * Expire every session cookie this app sets. Plus is not lost: it lives in
 * durable storage keyed by YouTube channel and comes back on the next verify.
 */
function logoutResponse(request: Request): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  headers.append("Set-Cookie", clearCookie(request, YT_STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(request, YT_CHANNEL_COOKIE));
  headers.append("Set-Cookie", clearCookie(request, YT_ID_TOKEN_COOKIE));
  headers.append("Set-Cookie", clearYtAccountCookie(request));
  headers.append("Set-Cookie", clearPlusCookie(request));
  headers.append("Set-Cookie", "matchcut_ref=; Path=/; Max-Age=0; SameSite=Lax");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export const Route = createFileRoute("/api/youtube/logout")({
  server: {
    handlers: {
      // POST only: a GET logout can be triggered cross-site by any <img> tag.
      POST: async ({ request }) => logoutResponse(request),
    },
  },
});
