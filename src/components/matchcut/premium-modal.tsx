import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { FREE_DAILY } from "@/data/creators";
import { cn } from "@/lib/cn";
import { useDeck } from "@/lib/deck-store";
import { startStripeCheckout } from "@/lib/stripe-client";

const PERKS = [
  "Unlimited daily swipes",
  "Pitch channels with 5,000 subscribers or more",
  "Your note sits above the cold-email pile",
];

export function PremiumModal() {
  const open = useDeck((state) => state.premiumOpen && state.gate !== "limit");
  const gate = useDeck((state) => state.gate);
  const premium = useDeck((state) => state.premium);
  const closePremium = useDeck((state) => state.closePremium);
  const premiumUntil = useDeck((state) => state.premiumUntil);
  const gateMessage = useDeck((state) => state.gateMessage);
  const [buyingPitch, setBuyingPitch] = useState(false);
  const [plan, setPlan] = useState<"month" | "year">("month");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!open) {
      setPlan("month");
      setCheckoutError("");
      setCheckingOut(false);
      setBuyingPitch(false);
    }
  }, [open]);

  const lead = gateMessage
    ? gateMessage
    : gate === "limit"
      ? `Today's ${FREE_DAILY} free swipes are used.`
      : gate === "flagship"
        ? "Free accounts can only pitch channels under 5,000 subscribers. Plus unlocks pitches to channels with 5,000 or more."
        : "Pitch the channels that don't answer cold emails.";

  const title = premium ? "You're on Plus" : "Unlimited pitches";

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && closePremium()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal-panel rounded-card bg-cream p-6 text-ink-text shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">Smash Collab Plus</p>
              <Dialog.Title className="mt-1 font-display text-3xl leading-tight">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-strong">
                {premium
                  ? `Daily swipes are unlimited, including pitches to channels with 5,000 or more subscribers.${
                      premiumUntil ? ` Active through ${new Date(premiumUntil).toLocaleDateString()}.` : ""
                    }`
                  : lead}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-cream-deep"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {premium ? (
            <div className="mt-6">
              <ul className="mt-4 space-y-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={closePremium}
                className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
              >
                Back to the desk
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan">
                {(
                  [
                    { id: "month" as const, price: "$7", cadence: "per month" },
                    { id: "year" as const, price: "$75", cadence: "per year" },
                  ]
                ).map((option) => {
                  const on = plan === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPlan(option.id)}
                      className={cn(
                        "press min-h-20 rounded-control border px-3 py-3 text-left",
                        on ? "border-ink-text bg-cream-deep" : "border-cream-deep",
                      )}
                    >
                      <span className="block font-display text-3xl leading-none">{option.price}</span>
                      <span className="mt-1 block text-sm text-muted-strong">{option.cadence}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-muted-strong">Annual is $75 for the year.</p>
              <ul className="mt-4 space-y-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-strong">
                Free includes {FREE_DAILY} pitches a day, only to channels under 5,000 subscribers.
              </p>
              <p className="mt-3 text-sm text-muted-strong">Have a promo code? Enter it on the secure Stripe checkout page.</p>
              <button
                type="button"
                disabled={checkingOut}
                onClick={() => {
                  setCheckingOut(true);
                  void startStripeCheckout(plan).then((error) => {
                    setCheckingOut(false);
                    setCheckoutError(error ?? "");
                  });
                }}
                className="press mt-5 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-60"
              >
                {checkingOut ? "Opening checkout" : plan === "year" ? "Continue with Annual" : "Continue with Monthly"}
              </button>
              {gate === "flagship" ? (
                <button
                  type="button"
                  disabled={buyingPitch}
                  onClick={() => {
                    setBuyingPitch(true);
                    void startStripeCheckout("pitch").then((error) => {
                      setBuyingPitch(false);
                      setCheckoutError(error ?? "");
                    });
                  }}
                  className="press mt-2 h-12 w-full rounded-control border border-ink-text text-sm font-medium disabled:opacity-60"
                >
                  {buyingPitch ? "Opening checkout" : "Buy 1 Pitch for $1.00"}
                </button>
              ) : null}
              {checkoutError ? (
                <p className="mt-2 text-sm text-accent-deep" role="alert">
                  {checkoutError}
                </p>
              ) : null}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
