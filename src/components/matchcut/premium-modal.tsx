import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { FREE_DAILY } from "@/data/creators";
import { cn } from "@/lib/cn";
import { useDeck } from "@/lib/deck-store";
import { startStripeCheckout } from "@/lib/stripe-client";

const PERKS = [
  "Unlimited daily swipes",
  "Pitch flagship channels, 1M and up",
  "Your note sits above the cold-email pile",
];

const PROMO_CODES = new Set(["BETA", "FREETRIAL"]);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function PremiumModal() {
  const open = useDeck((state) => state.premiumOpen && state.gate !== "limit");
  const gate = useDeck((state) => state.gate);
  const premium = useDeck((state) => state.premium);
  const closePremium = useDeck((state) => state.closePremium);
  const setPremium = useDeck((state) => state.setPremium);
  const [plan, setPlan] = useState<"month" | "year">("month");
  const [done, setDone] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [yearFree, setYearFree] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!open) {
      setDone(false);
      setRedeemed(false);
      setPlan("month");
      setCode("");
      setCodeError("");
      setYearFree(false);
      setCheckoutError("");
      setCheckingOut(false);
    }
  }, [open]);

  function applyCode() {
    if (code.trim().toLowerCase() === "mrfedora") {
      setCodeError("");
      setYearFree(true);
      setPremium(true, Date.now() + YEAR_MS, "1 Year Free Applied!");
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!PROMO_CODES.has(normalized)) {
      setCodeError("That code isn't active.");
      setYearFree(false);
      return;
    }
    setCodeError("");
    setYearFree(false);
    setRedeemed(true);
    setDone(true);
    setPremium(true, Date.now() + THIRTY_DAYS_MS);
  }

  const lead =
    gate === "limit"
      ? `Today's ${FREE_DAILY} free swipes are used.`
      : gate === "flagship"
        ? "Flagship channels only take a Plus pitch."
        : "Pitch the channels that don't answer cold emails.";

  const title = redeemed ? "Premium Unlocked for 30 Days" : premium && !done ? "You're on Plus" : "Unlimited cuts";

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
                {redeemed
                  ? "Unlimited swipes and flagship pitches are on for the next 30 days."
                  : premium && !done
                    ? "Daily swipes are unlimited, and flagship pitches are open."
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

          {done || (premium && !done && !yearFree) ? (
            <div className="mt-6">
              {done && !redeemed ? (
                <p className="text-sm leading-relaxed text-muted-strong">
                  Plus is on for this preview. The daily cap is gone, and you can pitch flagship channels. No
                  charge was made.
                </p>
              ) : null}
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
              {premium ? (
                <button
                  type="button"
                  onClick={() => {
                    setPremium(false);
                    closePremium();
                  }}
                  className="press mt-2 h-11 w-full text-sm text-muted-strong"
                >
                  Revert to Free
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan">
                {(
                  [
                    { id: "month" as const, price: "$9.99", cadence: "per month" },
                    { id: "year" as const, price: "$107.89", cadence: "per year" },
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
              <p className="mt-3 text-sm text-muted-strong">Annual is 10% off the monthly rate.</p>
              <ul className="mt-4 space-y-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted-strong">
                Free includes {FREE_DAILY} pitches a day. Flagship channels stay view-only.
              </p>
              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyCode();
                }}
              >
                <label htmlFor="promo-code" className="text-sm font-medium">
                  Promo Code
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="promo-code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value);
                      if (codeError) setCodeError("");
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-12 min-w-0 flex-1 rounded-control border border-cream-deep bg-cream px-3 text-sm text-ink-text"
                  />
                  <button
                    type="submit"
                    className="press h-12 shrink-0 rounded-control border border-ink-text px-4 text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
                {yearFree ? (
                  <p className="mt-2 text-sm font-medium text-status-accepted" role="status">
                    1 Year Free Applied!
                  </p>
                ) : null}
                {codeError ? (
                  <p className="mt-2 text-sm text-accent-deep" role="alert">
                    {codeError}
                  </p>
                ) : null}
              </form>
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
