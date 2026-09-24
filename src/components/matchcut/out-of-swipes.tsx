import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { FREE_DAILY } from "@/data/creators";
import { useDeck } from "@/lib/deck-store";
import { startStripeCheckout } from "@/lib/stripe-client";

export function OutOfSwipes() {
  const open = useDeck((state) => state.premiumOpen && state.gate === "limit");
  const closePremium = useDeck((state) => state.closePremium);
  const openPremium = useDeck((state) => state.openPremium);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setBuying(false);
      setError("");
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && closePremium()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal-panel rounded-card bg-cream p-6 text-ink-text shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-3xl leading-tight">Out of Swipes</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-strong">
                Today's {FREE_DAILY} free pitches are used.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-cream-deep"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => openPremium(null)}
              className="press h-12 rounded-control bg-accent px-4 text-sm font-medium text-on-accent"
            >
              Unlock Unlimited for $9.99/mo
            </button>
            <button
              type="button"
              disabled={buying}
              onClick={() => {
                setBuying(true);
                setError("");
                void startStripeCheckout("pitch").then((message) => {
                  setBuying(false);
                  setError(message ?? "");
                });
              }}
              className="press h-12 rounded-control border border-ink-text px-4 text-sm font-medium disabled:opacity-60"
            >
              {buying ? "Opening checkout" : "Buy 1 Pitch for $0.99"}
            </button>
            {error ? (
              <p className="text-sm text-accent-deep" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
