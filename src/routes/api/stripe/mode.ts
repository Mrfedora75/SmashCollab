import { createFileRoute } from "@tanstack/react-router";
import { isStorageConfigured } from "@/lib/server/firestore.server";
import { liveModeBlocked, stripeMode } from "@/lib/stripe-billing.server";
import { env } from "@/lib/env.server";

/** Non-secret readiness info: Stripe test/live mode from the key prefix, never the key. */
export const Route = createFileRoute("/api/stripe/mode")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            stripe: stripeMode(),
            liveBlocked: liveModeBlocked(),
            webhookSecret: Boolean(env("STRIPE_WEBHOOK_SECRET")),
            durableStorage: isStorageConfigured(),
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
