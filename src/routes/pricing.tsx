import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PublicPage } from "@/components/marketing/public-page";
import { StartButton } from "@/components/marketing/public-header";
import { PRICING, SUBSCRIBER_LIMIT_LABEL } from "@/lib/pricing";
import { FreePlanDetails } from "@/components/marketing/free-plan-details";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · Smash Collab" },
      {
        name: "description",
        content: `Smash Collab is free with ${PRICING.freeDaily} collabs a day. Plus is ${PRICING.plusMonthly}/month or ${PRICING.plusAnnual}/year for unlimited collabs. Extra collabs are ${PRICING.extraCollab} each.`,
      },
    ],
  }),
  component: PricingPage,
});

const FREE = [
  "Your own creator profile",
  "Browse creators of every niche and size",
  `${PRICING.freeDaily} free collab requests every day`,
  `Free collabs go to channels under ${SUBSCRIBER_LIMIT_LABEL} subscribers`,
  "Matches and messaging",
];

const PLUS = [
  "Everything in Free",
  "Unlimited collab requests",
  `Collab with channels that have ${SUBSCRIBER_LIMIT_LABEL}+ subscribers`,
  "Cancel anytime — Plus stays on until the end of the period you paid for",
];

function PricingPage() {
  return (
    <PublicPage>
      <p className="text-xs font-medium tracking-widest text-accent uppercase">Pricing</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Free to start. Plus when you want more.</h1>
      <p className="mt-4 max-w-2xl text-cream/80">
        Making a profile, browsing creators, matching, and messaging are free. Upgrade only if you want more collab requests or want
        to reach bigger channels.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="flex flex-col rounded-card border border-line bg-ink-soft p-6">
          <h2 className="font-display text-3xl">Free</h2>
          <p className="mt-2 font-display text-5xl">$0</p>
          <p className="mt-1 text-sm text-muted">forever</p>
          <ul className="mt-6 flex flex-col gap-3">
            {FREE.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <StartButton className="mt-8 w-full">Get started free</StartButton>
        </section>

        <section className="flex flex-col rounded-card border border-accent bg-ink-soft p-6">
          <h2 className="font-display text-3xl">Plus</h2>
          <p className="mt-2 font-display text-5xl">
            {PRICING.plusMonthly}
            <span className="text-lg font-normal text-muted"> / month</span>
          </p>
          <p className="mt-1 text-sm text-muted">or {PRICING.plusAnnual} / year</p>
          <ul className="mt-6 flex flex-col gap-3">
            {PLUS.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-cream/80">
            Sign in, then tap <strong>Upgrade</strong> at the top of the app. Payments are handled securely by Stripe.
          </p>
        </section>
      </div>

      <FreePlanDetails className="mt-4" />

      <section className="mt-4 rounded-card border border-line p-6">
        <h2 className="font-display text-2xl">Extra collabs — {PRICING.extraCollab} each</h2>
        <p className="mt-2 text-sm leading-relaxed text-cream/80">
          Used all of today’s free collabs, or want to reach a channel with {SUBSCRIBER_LIMIT_LABEL}+ subscribers without Plus? Buy a
          single collab for {PRICING.extraCollab}. No subscription needed.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted">
        Free collabs reset every day. Prices are in US dollars. Questions? See the{" "}
        <Link to="/info" className="underline underline-offset-2">
          FAQ
        </Link>{" "}
        or the{" "}
        <Link to="/terms" className="underline underline-offset-2">
          Terms of Service
        </Link>
        .
      </p>
    </PublicPage>
  );
}
