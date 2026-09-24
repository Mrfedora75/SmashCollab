import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";
import { applyCheckoutSession, grantPlus, revokePlus, stripeRequest, verifyStripeSignature } from "@/lib/stripe-billing.server";

type StripeEvent = {
  type?: string;
  data?: {
    object?: {
      id?: string;
      metadata?: Record<string, string>;
      customer?: string | null;
      current_period_end?: number;
    };
  };
};

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = env("STRIPE_WEBHOOK_SECRET");
        if (!secret) {
          return Response.json({ error: "Webhook secret is not configured." }, { status: 500 });
        }
        const payload = await request.text();
        if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
          return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
        }
        let event: StripeEvent;
        try {
          event = JSON.parse(payload) as StripeEvent;
        } catch {
          return Response.json({ error: "Invalid payload." }, { status: 400 });
        }
        const object = event.data?.object;
        if (event.type === "checkout.session.completed" && object?.id) {
          const session = await stripeRequest<Parameters<typeof applyCheckoutSession>[0]>(
            `checkout/sessions/${object.id}`,
            undefined,
            "GET",
          );
          await applyCheckoutSession(session);
        }
        if (
          (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") &&
          object?.metadata?.channelId
        ) {
          const channelId = object.metadata.channelId;
          const ended = event.type === "customer.subscription.deleted" || (object.current_period_end ?? 0) * 1000 <= Date.now();
          if (ended) await revokePlus(channelId);
          else if (typeof object.current_period_end === "number") {
            await grantPlus(channelId, object.current_period_end * 1000, object.customer ?? null, object.id ?? null);
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
