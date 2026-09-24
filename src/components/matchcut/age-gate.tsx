import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

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
                This platform is only for people 18 or older. You can’t browse channels or send pitches.
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
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
