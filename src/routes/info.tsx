import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage } from "@/components/marketing/public-page";
import { StartButton } from "@/components/marketing/public-header";
import { CONTACT_EMAIL } from "@/components/site-footer";
import { PRICING, SUBSCRIBER_LIMIT_LABEL } from "@/lib/pricing";

export const Route = createFileRoute("/info")({
  head: () => ({
    meta: [
      { title: "About & FAQ · Smash Collab" },
      {
        name: "description",
        content: "What Smash Collab is, how matching works, and answers to common questions from YouTube creators.",
      },
    ],
  }),
  component: InfoPage,
});

const FAQ: Array<{ q: string; a: ReactNode }> = [
  {
    q: "Who is Smash Collab for?",
    a: "Any YouTube creator, in any niche and of any size, who wants to find other creators to make videos with.",
  },
  {
    q: "How does it work?",
    a: "Make a profile by verifying your channel and picking your niches. Then browse other creators one card at a time and tap Pass or Collab. If you both tap Collab, it’s a match and you can message each other to plan your video.",
  },
  {
    q: "What’s a “collab request”?",
    a: "When you tap Collab on a creator’s card (optionally with a short note), they see it in their Matches & Messages. If they collab back, you match.",
  },
  {
    q: "Is it free?",
    a: (
      <>
        Yes. Free accounts get {PRICING.freeDaily} collab requests a day with channels under {SUBSCRIBER_LIMIT_LABEL} subscribers.
        Plus ({PRICING.plusMonthly}/month or {PRICING.plusAnnual}/year) gives unlimited collabs, including bigger channels, and extra
        single collabs are {PRICING.extraCollab}. See{" "}
        <Link to="/pricing" className="underline underline-offset-2">
          Pricing
        </Link>
        .
      </>
    ),
  },
  {
    q: "Why do I sign in with Google?",
    a: "To prove you own your YouTube channel. We ask for read-only YouTube access, use it to read your channel name, picture, and subscriber count, and never post, upload, or change anything. We never see your Google password.",
  },
  {
    q: "Why do I have to be 18 or older?",
    a: "Smash Collab connects strangers who message each other, so it’s for adults only.",
  },
  {
    q: "Can I block someone?",
    a: "Yes. You can block any creator you’ve matched with from your chat, and unblock them later in Settings.",
  },
  {
    q: "How do I delete my account?",
    a: (
      <>
        Email{" "}
        <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{" "}
        and we’ll delete your account and data, as described in the{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
];

function InfoPage() {
  return (
    <PublicPage>
      <p className="text-xs font-medium tracking-widest text-accent uppercase">About Smash Collab</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Where YouTube creators find collab partners</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/80">
        Collabs are one of the best ways to grow a channel, but finding the right partner usually means cold emails that never get
        answered. Smash Collab puts creators who <em>want</em> to collab in one place, lets you browse them by niche and size, and
        connects you when the interest is mutual.
      </p>

      <h2 className="mt-12 font-display text-3xl">Frequently asked questions</h2>
      <div className="mt-6 flex flex-col gap-3">
        {FAQ.map((item) => (
          <details key={item.q} className="group rounded-card border border-line bg-ink-soft px-5 py-4">
            <summary className="cursor-pointer list-none font-medium text-cream marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span aria-hidden="true" className="text-xl leading-none text-accent transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-cream/80">{item.a}</div>
          </details>
        ))}
      </div>

      <section className="mt-12 rounded-card border border-line p-6 text-center">
        <h2 className="font-display text-3xl">Still have questions?</h2>
        <p className="mt-2 text-sm text-cream/80">
          Email us at{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <StartButton className="mt-6 w-full sm:w-auto">Get started free</StartButton>
      </section>
    </PublicPage>
  );
}
