import { createFileRoute } from "@tanstack/react-router";
import { getAppHomeUrl } from "@/lib/youtube/config";
import { exchangeCodeForTokens } from "@/lib/youtube/oauth";
import { completeYouTubeGrant, redirectOAuthError } from "@/lib/youtube/oauth-result";
import { parseCookieHeader, YT_STATE_COOKIE } from "@/lib/youtube/session";

function sameState(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 32) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const home = getAppHomeUrl(request);
        const url = new URL(request.url);
        if (url.searchParams.get("error")) {
          return redirectOAuthError(request, home, "denied");
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookies = parseCookieHeader(request);
        const expectedState = cookies[YT_STATE_COOKIE];

        // CSRF protection: the state must match the one we stored in an HttpOnly cookie.
        if (!code || !state || !expectedState || !sameState(state, expectedState)) {
          return redirectOAuthError(request, home, "state");
        }

        const tokenResult = await exchangeCodeForTokens(request, code);
        if ("reason" in tokenResult) {
          return redirectOAuthError(request, home, tokenResult.reason);
        }

        return completeYouTubeGrant(request, home, tokenResult);
      },
    },
  },
});
