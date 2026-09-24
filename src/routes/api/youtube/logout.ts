import { createFileRoute } from "@tanstack/react-router";
import { clearYtAccountCookie } from "@/lib/youtube/plus-entitlement";
import {
  clearCookie,
  YT_CHANNEL_COOKIE,
  YT_STATE_COOKIE,
} from "@/lib/youtube/session";

/**
 * Clears YouTube OAuth/session cookies only.
 * Intentionally does NOT clear `matchcut_plus` so remaining Plus time
 * can be restored after the next YouTube verification.
 */
function logoutResponse(request: Request): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  headers.append("Set-Cookie", clearCookie(request, YT_STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(request, YT_CHANNEL_COOKIE));
  headers.append("Set-Cookie", clearYtAccountCookie(request));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export const Route = createFileRoute("/api/youtube/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => logoutResponse(request),
      GET: async ({ request }) => logoutResponse(request),
    },
  },
});
