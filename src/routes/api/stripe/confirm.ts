import { createFileRoute } from "@tanstack/react-router";
import { applyCheckoutSession, fetchCheckoutSession } from "@/lib/stripe-billing.server";
import { plusCookieFor, requestAccount, resolvePlus } from "@/lib/youtube/plus-entitlement";
import { syncPublicPlus } from "@/lib/server/public-profile.server";

/**
 * Success-redirect handler. Re-fetches the Checkout Session from Stripe with
 * the secret key (the browser's word is never trusted), checks it belongs to
 * the signed-in channel and is paid, then applies it idempotently.
 */
export const Route = createFileRoute("/api/stripe/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const noStore = { "Cache-Control": "no-store" };
        const account = await requestAccount(request);
        if (!account) return Response.json({ error: "Verify via YouTube first." }, { status: 401, headers: noStore });
        const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
        if (!sessionId) return Response.json({ error: "Missing checkout session." }, { status: 400, headers: noStore });
        try {
          const session = await fetchCheckoutSession(sessionId);
          if (session.metadata?.channelId !== account.channelId) {
            return Response.json({ error: "This checkout belongs to a different channel." }, { status: 403, headers: noStore });
          }
          const result = await applyCheckoutSession(session);
          const paid = result.applied || result.reason === "already-applied";
          const status = await resolvePlus(request, account);
          if (status.storage === "ok") await syncPublicPlus(account.channelId, status);
          const headers = new Headers({ ...noStore, "Content-Type": "application/json" });
          const cookie = await plusCookieFor(request, account, status);
          if (cookie) headers.append("Set-Cookie", cookie);
          return new Response(JSON.stringify({ paid, kind: result.kind, ...status }), { status: 200, headers });
        } catch {
          return Response.json({ error: "Could not confirm the payment yet." }, { status: 502, headers: noStore });
        }
      },
    },
  },
});
