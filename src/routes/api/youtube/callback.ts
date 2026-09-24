import { createFileRoute } from "@tanstack/react-router";
import { getAppHomeUrl } from "@/lib/youtube/config";
import {
  errorHomeRedirect,
  exchangeCodeForTokens,
  fetchVerifiedChannel,
  type YouTubeOAuthErrorReason,
} from "@/lib/youtube/oauth";
import {
  buildYtAccountCookie,
  signYtAccount,
} from "@/lib/youtube/plus-entitlement";
import {
  buildCookie,
  clearCookie,
  parseCookieHeader,
  signVerifiedChannel,
  YT_CHANNEL_COOKIE,
  YT_STATE_COOKIE,
} from "@/lib/youtube/session";

function redirectOk(home: string, setCookies: string[]): Response {
  const url = new URL(home);
  url.searchParams.set("yt", "ok");
  const headers = new Headers({ Location: url.toString() });
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function redirectError(
  request: Request,
  home: string,
  reason: YouTubeOAuthErrorReason,
): Response {
  const response = errorHomeRedirect(home, reason);
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", clearCookie(request, YT_STATE_COOKIE));
  return new Response(null, { status: 302, headers });
}

export const Route = createFileRoute("/api/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const home = getAppHomeUrl(request);
        const url = new URL(request.url);
        if (url.searchParams.get("error")) {
          return redirectError(request, home, "denied");
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookies = parseCookieHeader(request);
        const expectedState = cookies[YT_STATE_COOKIE];

        if (!code || !state || !expectedState || state !== expectedState) {
          return redirectError(request, home, "state");
        }

        const tokenResult = await exchangeCodeForTokens(request, code);
        if ("reason" in tokenResult) {
          return redirectError(request, home, tokenResult.reason);
        }

        const channelResult = await fetchVerifiedChannel(tokenResult.accessToken);
        if ("reason" in channelResult) {
          return redirectError(request, home, channelResult.reason);
        }

        const signedChannel = await signVerifiedChannel(channelResult);
        const signedAccount = await signYtAccount(channelResult.channelId);
        return redirectOk(home, [
          clearCookie(request, YT_STATE_COOKIE),
          buildCookie(request, YT_CHANNEL_COOKIE, signedChannel, 600),
          buildYtAccountCookie(request, signedAccount),
        ]);
      },
    },
  },
});
