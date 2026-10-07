import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Layers, MessageCircle, Send, ShieldCheck, UserPlus, X } from "lucide-react";
import { PublicHeader, StartButton } from "@/components/marketing/public-header";
import { SiteFooter } from "@/components/site-footer";
import { PRICING, SUBSCRIBER_LIMIT_LABEL } from "@/lib/pricing";

const STEPS = [
  {
    icon: UserPlus,
    title: "Make your creator profile",
    body: "Sign in with Google and verify your YouTube channel (read-only). Pick the niches you make videos in.",
  },
  {
    icon: Layers,
    title: "Browse creators by niche & size",
    body: "Flip through other creators’ channels one card at a time. Filter by niche, subscriber count, and location.",
  },
  {
    icon: MessageCircle,
    title: "Send a collab request and chat",
    body: "Tap Collab and add a short note. When they collab back, it’s a match and you can message each other.",
  },
] as const;

const POINTS = [
  { title: "Every niche is welcome", body: "Gaming, cooking, paranormal, music, tech, vlogs — whatever you make." },
  { title: "Small channels too", body: "Find creators your size, or reach a little higher. Filter by subscriber range." },
  { title: "Real, verified channels", body: "Every creator verifies their channel with YouTube, so you know who you’re talking to." },
] as const;

/** Public landing page shown at "/" to signed-out visitors. */
export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div data-landing className="flex min-h-dvh flex-col">
      <PublicHeader onStart={onStart} />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 overflow-x-clip px-4 pt-10 pb-14 sm:pt-16 md:grid-cols-[1.15fr_1fr] md:gap-12 md:pb-20">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-widest text-accent uppercase">For YouTube creators of every niche</p>
            <h1 className="mt-3 font-display text-[2.25rem] leading-[1.05] min-[375px]:text-[2.6rem] sm:text-6xl">Find your next YouTube collab partner.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream/80">
              Smash Collab helps YouTubers meet other creators who actually want to collab. Browse channels by niche and size,
              send a collab request, and start chatting when they say yes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StartButton onStart={onStart}>
                Get started free
                <ArrowRight className="size-4" aria-hidden="true" />
              </StartButton>
              <a
                href="#how-it-works"
                className="press inline-flex h-12 items-center justify-center rounded-control border border-line px-6 text-base text-cream"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">Free to join · Sign in with Google · 18+ only</p>
          </div>
          <SampleCard />
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-4 border-t border-line bg-ink-soft">
          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            <p className="text-xs font-medium tracking-widest text-accent uppercase">How it works</p>
            <h2 className="mt-2 font-display text-4xl leading-tight">Three steps to your next collab</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-card border border-line bg-ink p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-accent font-display text-lg text-on-accent">
                      {index + 1}
                    </span>
                    <step.icon className="size-5 text-cream/70" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl leading-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/75">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why */}
        <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <h2 className="font-display text-4xl leading-tight">Built for creators, not agencies</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <Check className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <h3 className="font-medium text-cream">{point.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-cream/75">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-start gap-2 text-sm text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            We only ask YouTube for read-only access. We never post, upload, or change anything on your channel.
          </p>
        </section>

        {/* Pricing teaser */}
        <section className="border-t border-line bg-ink-soft">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 md:grid-cols-2 md:py-20">
            <div className="rounded-card border border-line bg-ink p-6">
              <p className="text-sm text-muted">Free</p>
              <p className="mt-1 font-display text-4xl">$0</p>
              <p className="mt-3 text-sm leading-relaxed text-cream/80">
                {PRICING.freeDaily} free collabs every day with channels under {SUBSCRIBER_LIMIT_LABEL} subscribers. Matches and
                messaging included.
              </p>
            </div>
            <div className="rounded-card border border-accent bg-ink p-6">
              <p className="text-sm text-accent">Plus</p>
              <p className="mt-1 font-display text-4xl">
                {PRICING.plusMonthly}
                <span className="text-base font-normal text-muted"> / month</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-cream/80">
                Or {PRICING.plusAnnual} a year. Unlimited collabs, including channels with {SUBSCRIBER_LIMIT_LABEL}+ subscribers. Not
                ready for Plus? Extra collabs are {PRICING.extraCollab} each.
              </p>
            </div>
            <p className="text-sm text-cream/80 md:col-span-2">
              <Link to="/pricing" className="underline underline-offset-2">
                See full pricing
              </Link>
              {" · "}
              <Link to="/info" className="underline underline-offset-2">
                Questions? Read the FAQ
              </Link>
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">Your next collab is a few cards away.</h2>
          <p className="mt-4 text-cream/80">Make your free creator profile in about a minute.</p>
          <StartButton onStart={onStart} className="mt-8 w-full sm:w-auto">
            Get started free
            <ArrowRight className="size-4" aria-hidden="true" />
          </StartButton>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Decorative example of a creator card (not a real creator). */
function SampleCard() {
  return (
    <div className="relative mx-auto w-[calc(100%-1.5rem)] max-w-sm" aria-hidden="true">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-card border border-line bg-ink-soft" />
      <div className="relative rounded-card bg-cream p-5 text-ink-text shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent font-display text-2xl text-on-accent">Y</span>
          <div className="min-w-0">
            <p className="truncate font-display text-2xl leading-tight">@YourNextCollab</p>
            <p className="text-sm text-muted-strong">3.2K subscribers · ~900 views</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Gaming", "Comedy"].map((niche) => (
            <span key={niche} className="rounded-full bg-cream-deep px-3 py-1 text-xs font-medium">
              {niche}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-strong">
          “Weekly co-op let’s plays. Looking for a creator to do a challenge video with!”
        </p>
        <p className="mt-2 text-xs text-muted-strong">Example card</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <span className="flex h-12 items-center justify-center gap-2 rounded-control border border-ink-text/30 text-sm font-medium">
            <X className="size-4" /> Pass
          </span>
          <span className="flex h-12 items-center justify-center gap-2 rounded-control bg-accent text-sm font-medium text-on-accent">
            <Send className="size-4" /> Collab
          </span>
        </div>
      </div>
    </div>
  );
}
