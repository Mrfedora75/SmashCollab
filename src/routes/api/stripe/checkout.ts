import { createFileRoute } from "@tanstack/react-router";
import { getAppHomeUrl } from "@/lib/youtube/config";
import { isStorageConfigured } from "@/lib/server/firestore.server";
import { liveModeBlocked, resolvePriceId, stripeRequest, stripeSecret, type Plan } from "@/lib/stripe-billing.server";
import { requestAccount } from "@/lib/youtube/plus-entitlement";

const noStore = { "Cache-Control": "no-store" };

function parsePlan(value: unknown): Plan | null {
  return value === "month" || value === "year" || value === "pitch" ? value : null;
}

export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { plan?: unknown } = {};
        try {
          body = (await request.json()) as { plan?: unknown };
        } catch {
          body = {};
        }
        const plan = parsePlan(body.plan);
        if (!plan) return Response.json({ error: "Choose a plan to continue." }, { status: 400, headers: noStore });

        // The buyer is the verified YouTube channel from the signed session cookie,
        // never an id sent by the browser.
        const account = await requestAccount(request);
        if (!account) {
          return Response.json({ error: "Verify your YouTube channel before upgrading." }, { status: 401, headers: noStore });
        }
        if (!stripeSecret()) {
          return Response.json({ error: "Payments are not set up yet." }, { status: 503, headers: noStore });
        }
        if (liveModeBlocked()) {
          // Safety: this deployment only takes Stripe TEST payments unless STRIPE_ALLOW_LIVE=true.
          return Response.json({ error: "Payments are in test mode only right now." }, { status: 503, headers: noStore });
        }
        if (!isStorageConfigured()) {
          // Without durable storage a paid upgrade could not be recorded, so do not take money.
          return Response.json({ error: "Payments are not available yet." }, { status: 503, headers: noStore });
        }

        try {
          const price = await resolvePriceId(plan);
          const home = getAppHomeUrl(request).replace(/\/$/, "");
          const channelId = account.channelId;
          const params = new URLSearchParams();
          params.set("mode", plan === "pitch" ? "payment" : "subscription");
          params.set("line_items[0][price]", price);
          params.set("line_items[0][quantity]", "1");
          params.set("success_url", `${home}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
          params.set("cancel_url", `${home}/?checkout=cancel`);
          params.set("client_reference_id", channelId);
          params.set("allow_promotion_codes", "true");
          params.set("metadata[channelId]", channelId);
          params.set("metadata[kind]", plan === "pitch" ? "pitch" : "plus");
          params.set("metadata[plan]", plan);
          if (plan !== "pitch") {
            params.set("subscription_data[metadata][channelId]", channelId);
            params.set("subscription_data[metadata][kind]", "plus");
            params.set("subscription_data[metadata][plan]", plan);
          }
          const session = await stripeRequest<{ url?: string }>("checkout/sessions", params);
          if (!session.url) {
            return Response.json({ error: "Stripe did not return a checkout link." }, { status: 502, headers: noStore });
          }
          return Response.json({ url: session.url }, { headers: noStore });
        } catch {
          return Response.json({ error: "Checkout could not start. Try again in a minute." }, { status: 502, headers: noStore });
        }
      },
    },
  },
});
