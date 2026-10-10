import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CardFace } from "@/components/matchcut/card-face";
import { START_HREF } from "@/components/marketing/public-header";
import { isPlusChannel } from "@/data/creators";
import { SAMPLE_CREATORS } from "@/data/sample-creators";
import { PRICING } from "@/lib/pricing";

/**
 * Guest mode: browse SAMPLE channels and try the collab flow without signing in.
 * Everything here is local component state. Nothing is saved, nothing is sent, and no
 * real member data is loaded. Saving a profile or sending a collab asks for Google sign-in.
 */
export function GuestDesk() {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [composing, setComposing] = useState(false);
  const [signIn, setSignIn] = useState<null | "collab" | "profile">(null);
  const top = SAMPLE_CREATORS[index % SAMPLE_CREATORS.length];
  const next = () => {
    setComposing(false);
    setNote("");
    setIndex((i) => i + 1);
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-4 rounded-control border border-accent bg-accent/10 p-3 text-sm" role="note">
        <p className="font-medium">Guest mode: SAMPLE channels</p>
        <p className="mt-1 text-cream/80">
          These are made-up sample creators, not real people. Nothing you do here is saved or sent.
        </p>
      </div>
      <p className="mb-2 text-center text-xs font-medium tracking-widest text-accent uppercase">Sample data</p>
      <CardFace creator={top} locked={isPlusChannel(top.subscribers)} />
      {composing ? (
        <div className="mt-4">
          <label htmlFor="guest-note" className="block text-sm font-medium">
            Your collab note (practice)
          </label>
          <textarea
            id="guest-note"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 h-24 w-full rounded-control border border-line bg-ink p-2 text-sm"
            placeholder="Hey! Want to do a collab video?"
          />
          <button
            type="button"
            onClick={() => setSignIn("collab")}
            className="press mt-2 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
          >
            Send collab
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={next} className="press h-12 rounded-control border border-line text-sm font-medium">
            Pass
          </button>
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="press h-12 rounded-control bg-accent text-sm font-medium text-on-accent"
          >
            Collab
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setSignIn("profile")}
        className="press mt-3 h-11 w-full rounded-control border border-line text-sm font-medium"
      >
        Save my creator profile
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        On Free you get {PRICING.freeDaily} real collabs a day. Sample cards with a lock show what a Plus-only channel looks like.
      </p>

      <Dialog.Root open={signIn != null} onOpenChange={(open) => !open && setSignIn(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="age-scrim" />
          <Dialog.Content className="age-panel rounded-card bg-cream p-6 text-ink-text shadow-card">
            <Dialog.Title className="font-display text-2xl leading-tight">
              {signIn === "collab" ? "Sign in to send real collabs" : "Sign in to save your profile"}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-strong">
              That was a sample channel, so nothing was sent. Sign in with Google in one tap to meet real creators. No password to create.
            </Dialog.Description>
            <a
              href={START_HREF}
              className="press mt-5 flex h-12 w-full items-center justify-center rounded-control bg-accent text-sm font-medium text-on-accent"
            >
              Continue with Google
            </a>
            <button
              type="button"
              onClick={() => setSignIn(null)}
              className="press mt-2 h-11 w-full rounded-control border border-cream-deep text-sm font-medium"
            >
              Keep browsing samples
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
