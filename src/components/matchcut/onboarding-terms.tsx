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
          <p className="text-xs font-medium tracking-widest text-muted-strong">SmashCollab</p>
          <Dialog.Title className="mt-2 font-display text-3xl leading-tight">Safety & Terms</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-strong">
            Pitches stay on this desk. The channels are fictional, and nothing is emailed, uploaded, or billed.
          </Dialog.Description>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            <li>You already confirmed you are 18 or older.</li>
            <li>Notes and reviews are a preview. They are not sent to a creator.</li>
            <li>
              Verify via YouTube uses official Google OAuth and only reads public channel stats (title,
              subscriber count, and thumbnail).
            </li>
          </ul>
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
