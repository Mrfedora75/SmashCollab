import { createFileRoute } from "@tanstack/react-router";
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
              },
            },
          );
        }

        return Response.json(channel, {
          headers: {
            "Set-Cookie": clearCookie(request, YT_CHANNEL_COOKIE),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
