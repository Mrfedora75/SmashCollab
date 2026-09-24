import { createFileRoute } from "@tanstack/react-router";
import {
  buildYtAccountCookie,
  plusForChannel,
  signYtAccount,
} from "@/lib/youtube/plus-entitlement";
import {
  clearCookie,
  parseCookieHeader,
  readVerifiedChannel,
  YT_CHANNEL_COOKIE,
} from "@/lib/youtube/session";

export const Route = createFileRoute("/api/youtube/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cookies = parseCookieHeader(request);
        const channel = await readVerifiedChannel(cookies[YT_CHANNEL_COOKIE]);
        if (!channel) {
          return Response.json(
            { error: "No verified YouTube channel in session." },
            {
              status: 404,
              headers: {
                "Set-Cookie": clearCookie(request, YT_CHANNEL_COOKIE),
                "Cache-Control": "no-store",
              },
            },
          );
        }

        const plus = await plusForChannel(request, channel.channelId);
        const accountToken = await signYtAccount(channel.channelId);

        const headers = new Headers({ "Cache-Control": "no-store" });
        // One-shot handoff: clear short-lived verified channel cookie.
        headers.append("Set-Cookie", clearCookie(request, YT_CHANNEL_COOKIE));
        // Keep a longer-lived account identity for Plus grant/restore.
        headers.append("Set-Cookie", buildYtAccountCookie(request, accountToken));
        // Do NOT clear matchcut_plus.

        return Response.json(
          {
            channelId: channel.channelId,
            displayName: channel.displayName,
            channel: channel.channel,
            subscribers: channel.subscribers,
            avgViews: channel.avgViews,
            avatar: channel.avatar,
            premium: plus != null,
            premiumUntil: plus?.premiumUntil ?? null,
          },
          { headers },
        );
      },
    },
  },
});
