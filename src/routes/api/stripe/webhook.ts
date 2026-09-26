import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";
import {
  applyCheckoutSession,
  applySubscriptionEvent,
  fetchCheckoutSession,
  verifyStripeSignature,
  type StripeSubscription,
} from "@/lib/stripe-billing.server";
import { syncPublicPlus } from "@/lib/server/public-profile.server";

type StripeEvent = {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: { id?: string } & StripeSubscription };
};

/**
 * Stripe webhook. Register this URL in the Stripe dashboard (test mode) with:
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * customer.subscription.updated, customer.subscription.deleted.
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = env("STRIPE_WEBHOOK_SECRET");
        if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
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
        if (event.livemode === true && env("STRIPE_ALLOW_LIVE") !== "true") {
          // Test-mode deployment: acknowledge but ignore live events.
          return Response.json({ received: true, ignored: "livemode" });
        }
        const object = event.data?.object;
        try {
          if (
            (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
            object?.id
          ) {
            // Re-fetch so we act on Stripe's current view of the session.
            const session = await fetchCheckoutSession(object.id);
            const result = await applyCheckoutSession(session);
            if (result.kind === "plus") await syncPublicPlus(result.channelId);
          } else if (event.type === "customer.subscription.updated" && object) {
            if (await applySubscriptionEvent(object, false)) await syncPublicPlus(object.metadata?.channelId?.trim());
          } else if (event.type === "customer.subscription.deleted" && object) {
            if (await applySubscriptionEvent(object, true)) await syncPublicPlus(object.metadata?.channelId?.trim());
          }
        } catch {
          // Non-2xx makes Stripe retry later (e.g. storage briefly unavailable).
          return Response.json({ error: "Could not record this event yet." }, { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
