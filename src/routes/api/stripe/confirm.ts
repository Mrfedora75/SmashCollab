import { createFileRoute } from "@tanstack/react-router";
import { applyCheckoutSession, billingStatus, stripeRequest } from "@/lib/stripe-billing.server";

export const Route = createFileRoute("/api/stripe/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sessionId = new URL(request.url).searchParams.get("session_id")?.trim() ?? "";
        const channelId = new URL(request.url).searchParams.get("channelId")?.trim() ?? "";
        if (sessionId) {
          try {
            const session = await stripeRequest<Parameters<typeof applyCheckoutSession>[0]>(
              `checkout/sessions/${sessionId}`,
              undefined,
              "GET",
            );
            const account = await applyCheckoutSession(session);
            return Response.json(account, { headers: { "Cache-Control": "no-store" } });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not confirm payment.";
            return Response.json({ error: message }, { status: 502 });
          }
        }
        if (!channelId) {
          return Response.json({ error: "Missing account." }, { status: 400 });
        }
        return Response.json(await billingStatus(channelId), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
