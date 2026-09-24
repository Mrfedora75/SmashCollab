import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { FREE_DAILY } from "@/data/creators";
import { useDeck } from "@/lib/deck-store";

export function OutOfSwipes() {
  const open = useDeck((state) => state.premiumOpen && state.gate === "limit");
  const closePremium = useDeck((state) => state.closePremium);
  const setPremium = useDeck((state) => state.setPremium);
  const addExtraPitch = useDeck((state) => state.addExtraPitch);
  const [unlimited, setUnlimited] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [paid, setPaid] = useState(false);

  function reset() {
    setUnlimited(false);
    setCheckout(false);
    setPaid(false);
  }

  function closeAll() {
    reset();
    closePremium();
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) closeAll();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="modal-panel rounded-card bg-cream p-6 text-ink-text shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-3xl leading-tight">Out of Swipes</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-strong">
                  {unlimited
                    ? "Unlimited pitches are on. This preview does not charge $9.99."
                    : `Today's ${FREE_DAILY} free pitches are used.`}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-cream-deep"
                aria-label="Close"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            {unlimited ? (
              <button
                type="button"
                onClick={closeAll}
                className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
              >
                Back to the desk
              </button>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPremium(true);
                    setUnlimited(true);
                  }}
                  className="press h-12 rounded-control bg-accent px-4 text-sm font-medium text-on-accent"
                >
                  Unlock Unlimited for $9.99/mo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaid(false);
                    setCheckout(true);
                  }}
                  className="press h-12 rounded-control border border-ink-text px-4 text-sm font-medium"
                >
                  Buy 1 Extra Pitch for $0.99
                </button>
                <p className="mt-2 text-center text-xs text-muted-strong">Preview paywall. You will not be charged.</p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={open && checkout}
        onOpenChange={(next) => {
          if (!next) {
            setCheckout(false);
            if (paid) closeAll();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="confirm-scrim" />
          <Dialog.Content className="confirm-panel rounded-card bg-cream p-6 text-ink-text shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">Stripe</p>
                <Dialog.Title className="mt-1 font-display text-3xl leading-tight">
                  {paid ? "Payment successful" : "Pay $0.99"}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-strong">
                  {paid ? "1 extra pitch is ready." : "1 extra pitch. Card ···· 4242."}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-cream-deep"
                aria-label="Close checkout"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            {paid ? (
              <button
                type="button"
                onClick={closeAll}
                className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
              >
                Back to the desk
              </button>
            ) : (
              <>
                <p className="mt-5 text-sm text-muted-strong">Preview checkout. You will not be charged.</p>
                <button
                  type="button"
                  onClick={() => {
                    addExtraPitch();
                    setPaid(true);
                  }}
                  className="press mt-4 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
                >
                  Pay
                </button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
