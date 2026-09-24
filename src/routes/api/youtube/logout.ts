import { createFileRoute } from "@tanstack/react-router";
import {
  clearCookie,
  YT_CHANNEL_COOKIE,
  YT_STATE_COOKIE,
} from "@/lib/youtube/session";

function logoutResponse(request: Request): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  headers.append("Set-Cookie", clearCookie(request, YT_STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(request, YT_CHANNEL_COOKIE));
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
