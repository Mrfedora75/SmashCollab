import { createFileRoute } from "@tanstack/react-router";
import { getAppHomeUrl } from "@/lib/youtube/config";
import { priceIdFor, resolvePriceId, stripeRequest, stripeSecret } from "@/lib/stripe-billing.server";

type CheckoutBody = { plan?: string; channelId?: string };

export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: CheckoutBody = {};
        try {
          body = (await request.json()) as CheckoutBody;
        } catch {
          body = {};
        }
        const plan = body.plan === "year" || body.plan === "pitch" ? body.plan : body.plan === "month" ? "month" : null;
        const channelId = typeof body.channelId === "string" ? body.channelId.trim().slice(0, 80) : "";
        if (!plan || !channelId) {
          return Response.json({ error: "Choose a plan to continue." }, { status: 400 });
        }
        if (!stripeSecret()) {
          return Response.json({ error: "Stripe is not configured yet." }, { status: 500 });
        }
        const price = priceIdFor(plan) ?? (await resolvePriceId(plan));
        const home = getAppHomeUrl(request).replace(/\/$/, "");
        const params = new URLSearchParams();
        params.set("mode", plan === "pitch" ? "payment" : "subscription");
        params.set("line_items[0][price]", price);
        params.set("line_items[0][quantity]", "1");
        params.set("success_url", `${home}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
        params.set("cancel_url", `${home}/?checkout=cancel`);
        params.set("client_reference_id", channelId);
        params.set("metadata[channelId]", channelId);
        params.set("metadata[kind]", plan === "pitch" ? "pitch" : "plus");
        params.set("metadata[plan]", plan);
        if (plan !== "pitch") {
          params.set("subscription_data[metadata][channelId]", channelId);
          params.set("subscription_data[metadata][kind]", "plus");
          params.set("subscription_data[metadata][plan]", plan);
        }
        try {
          const session = await stripeRequest<{ url?: string }>("checkout/sessions", params);
          if (!session.url) {
            return Response.json({ error: "Stripe did not return a checkout link." }, { status: 502 });
          }
          return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Checkout could not start.";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
