import { createFileRoute } from "@tanstack/react-router";
import { plusCookieFor, requestAccount, resolvePlus } from "@/lib/youtube/plus-entitlement";

/**
 * Read-only Plus status for the verified YouTube channel in this session.
 * Plus can only be granted by a paid Stripe Checkout Session (webhook or
 * verified success redirect) or an invite reward — never by this route.
 */
export const Route = createFileRoute("/api/plus/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const account = await requestAccount(request);
        if (!account) {
          return Response.json(
            { premium: false, premiumUntil: null, pitchCredits: 0, channelId: null },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
        const status = await resolvePlus(request, account);
        const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json" });
        const cookie = await plusCookieFor(request, account, status);
        if (cookie) headers.append("Set-Cookie", cookie);
        return new Response(JSON.stringify({ ...status, channelId: account.channelId }), { status: 200, headers });
      },
    },
  },
});
