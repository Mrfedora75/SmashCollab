import { LegalLinks } from "@/components/site-footer";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AGE_CONFIRM_LABEL } from "@/lib/profile-policy";

const AGE_KEY = "matchcut-age";

type AgeChoice = "unknown" | "adult" | "minor";

export function useAgeGate() {
  const [age, setAge] = useState<AgeChoice>("unknown");

  useEffect(() => {
    if (localStorage.getItem(AGE_KEY) === "adult") setAge("adult");
  }, []);

  function choose(next: "adult" | "minor") {
    if (next === "adult") localStorage.setItem(AGE_KEY, "adult");
    setAge(next);
  }

  return { age, choose };
}

export function AgeGate({ age, onChoose }: { age: AgeChoice; onChoose: (next: "adult" | "minor") => void }) {
  return (
    <Dialog.Root open={age !== "adult"}>
      <Dialog.Portal>
        <Dialog.Overlay className="age-scrim" />
        <Dialog.Content
          className="age-panel rounded-card bg-cream p-6 text-ink-text shadow-card"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {age === "minor" ? (
            <>
              <Dialog.Title className="font-display text-3xl leading-tight">Access Denied</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-strong">
                This platform is only for people 18 or older. You can’t browse channels or send collabs.
              </Dialog.Description>
            </>
          ) : (
            <>
              <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">Smash Collab</p>
              <Dialog.Title className="mt-2 font-display text-3xl leading-tight">Age Verification Required</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-strong">
                You must be 18 or older to use this platform.
              </Dialog.Description>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onChoose("adult")}
                  className="press h-12 rounded-control bg-accent text-sm font-medium text-on-accent"
                >
                  I am 18 or older
                </button>
                <button
                  type="button"
                  onClick={() => onChoose("minor")}
                  className="press h-12 rounded-control border border-cream-deep text-sm font-medium"
                >
                  I am under 18
                </button>
              </div>
              <LegalLinks className="mt-4 text-center" />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Profiles saved before the age checkbox existed have no `ageConfirmed`, so the server keeps
 * them out of discovery and refuses their collabs until the creator ticks the box here.
 */
export function AgeConfirmPrompt({ open, onConfirm }: { open: boolean; onConfirm: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          <Dialog.Title className="font-display text-3xl leading-tight">Confirm your age</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-strong">
            Your profile stays hidden from other creators, and you can't send collabs, until you confirm this.
          </Dialog.Description>
          <label className="mt-5 flex items-start gap-3 rounded-control border border-cream-deep p-3 text-sm">
            <input type="checkbox" required checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
            <span className="font-medium">{AGE_CONFIRM_LABEL}</span>
          </label>
          {error ? <p className="mt-3 text-sm" role="alert">{error}</p> : null}
          <button
            type="button"
            disabled={!checked || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              onConfirm()
                .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not save. Try again."))
                .finally(() => setBusy(false));
            }}
            className="press mt-5 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
          >
            Confirm
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
