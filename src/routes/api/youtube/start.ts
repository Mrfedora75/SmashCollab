import { createFileRoute } from "@tanstack/react-router";
import { getAppHomeUrl, isYouTubeConfigured } from "@/lib/youtube/config";
import { buildGoogleAuthUrl, errorHomeRedirect } from "@/lib/youtube/oauth";
import { buildCookie, randomState, YT_STATE_COOKIE } from "@/lib/youtube/session";

export const Route = createFileRoute("/api/youtube/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const home = getAppHomeUrl(request);
        if (!isYouTubeConfigured()) {
          return errorHomeRedirect(home, "config");
        }

        const state = randomState();
        const authUrl = buildGoogleAuthUrl(request, state);
        if (!authUrl) {
          return errorHomeRedirect(home, "config");
        }

        const headers = new Headers({ Location: authUrl });
        headers.append("Set-Cookie", buildCookie(request, YT_STATE_COOKIE, state, 600));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
