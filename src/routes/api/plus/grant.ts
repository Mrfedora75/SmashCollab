import { createFileRoute } from "@tanstack/react-router";
import { isCompAccount, plusCookieFor, requestAccount, resolvePlus } from "@/lib/youtube/plus-entitlement";

/**
 * Tester comp. Grants free Plus ONLY when the verified session (signed
 * cookie from YouTube/Google OAuth) matches PLUS_COMP_EMAILS or
 * PLUS_COMP_CHANNEL_IDS. The request body is ignored entirely — nobody can
 * pick their own dates, channel, or plan. Everyone else gets 403 and must
 * upgrade through Stripe Checkout.
 */
export const Route = createFileRoute("/api/plus/grant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const noStore = { "Cache-Control": "no-store" };
        const account = await requestAccount(request);
        if (!account) {
          return Response.json({ error: "Verify via YouTube first." }, { status: 401, headers: noStore });
        }
        if (!isCompAccount(account)) {
          return Response.json({ error: "Plus is available through checkout." }, { status: 403, headers: noStore });
        }
        const status = await resolvePlus(request, account);
        const headers = new Headers({ ...noStore, "Content-Type": "application/json" });
        const cookie = await plusCookieFor(request, account, status);
        if (cookie) headers.append("Set-Cookie", cookie);
        return new Response(JSON.stringify({ ...status, channelId: account.channelId }), { status: 200, headers });
      },
    },
  },
});
