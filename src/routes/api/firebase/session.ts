import { createFileRoute } from "@tanstack/react-router";
import { clearCookie, parseCookieHeader, YT_ID_TOKEN_COOKIE } from "@/lib/youtube/session";

export const Route = createFileRoute("/api/firebase/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cookies = parseCookieHeader(request);
        const idToken = cookies[YT_ID_TOKEN_COOKIE] ?? "";
        const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
        headers.append("Set-Cookie", clearCookie(request, YT_ID_TOKEN_COOKIE));
        return new Response(JSON.stringify({ idToken: idToken || null }), { status: 200, headers });
      },
    },
  },
});
