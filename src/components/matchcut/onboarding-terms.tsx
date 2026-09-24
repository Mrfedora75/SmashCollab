import * as Dialog from "@radix-ui/react-dialog";
import { TERMS_KEY } from "@/components/matchcut/onboarding-storage";

export function TermsModal({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="age-scrim" />
        <Dialog.Content
          className="age-panel rounded-card bg-cream p-6 text-ink-text shadow-card"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <p className="text-xs font-medium tracking-widest text-muted-strong">Smash Collab</p>
          <Dialog.Title className="mt-2 font-display text-3xl leading-tight">Safety & Terms</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-strong">
            Smash Collab connects real creators using YouTube API Services. By signing in, you agree to be bound by the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-ink-text/40 underline-offset-2"
            >
              YouTube Terms of Service
            </a>{" "}
            and the{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-ink-text/40 underline-offset-2"
            >
              Google Privacy Policy
            </a>
            . You confirm you are 18 or older. All subscription and pitch purchases are processed securely via Stripe.
          </Dialog.Description>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(TERMS_KEY, "accepted");
              onAccept();
            }}
            className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
          >
            Accept and continue
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
