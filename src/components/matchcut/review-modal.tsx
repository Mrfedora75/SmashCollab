import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { CREATORS } from "@/data/creators";
import { ACCEPTED_COLLABS } from "@/data/inbox";
import { StarPicker } from "@/components/matchcut/stars";

export type SavedReview = { stars: number; note: string };

export function ReviewModal({
  collabId,
  saved,
  onClose,
  onReturn,
  onSave,
}: {
  collabId: string | null;
  saved?: SavedReview;
  onClose: () => void;
  onReturn?: () => void;
  onSave: (collabId: string, review: SavedReview) => void;
}) {
  const collab = ACCEPTED_COLLABS.find((item) => item.id === collabId);
  const creator = CREATORS.find((item) => item.id === collab?.creatorId);
  const [stars, setStars] = useState(saved?.stars ?? 0);
  const [note, setNote] = useState(saved?.note ?? "");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setStars(saved?.stars ?? 0);
    setNote(saved?.note ?? "");
    setSent(Boolean(saved));
  }, [collabId]);

  return (
    <Dialog.Root open={collabId != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal-panel rounded-card bg-cream p-6 text-ink-text shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">Completed collab</p>
              <Dialog.Title className="mt-1 font-display text-3xl leading-tight">Leave a Review</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-strong">
                {creator && collab
                  ? `${collab.title} with ${creator.channel}. This note stays on the desk.`
                  : "Rate a finished collaboration."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-cream-deep"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {sent ? (
            <p className="mt-6 text-sm leading-relaxed text-muted-strong" role="status">
              Review saved for {creator?.channel}. Nothing is published.
            </p>
          ) : null}
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (sent) {
                if (onReturn) onReturn();
                else onClose();
                return;
              }
              if (!collabId || stars < 1) return;
              onSave(collabId, { stars, note: note.trim() });
              setSent(true);
            }}
          >
            {sent ? null : (
              <>
                <p className="text-sm font-medium">Collab rating</p>
                <StarPicker value={stars} onChange={setStars} />
                <label htmlFor="review-note" className="mt-4 block text-sm font-medium">
                  Written feedback
                </label>
                <textarea
                  id="review-note"
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="How did the collab actually go?"
                  className="mt-2 w-full resize-none rounded-control border border-cream-deep bg-cream px-3 py-2 text-sm leading-relaxed text-ink-text placeholder:text-muted-strong"
                />
              </>
            )}
            <button
              type="submit"
              disabled={!sent && stars < 1}
              className="press mt-4 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
            >
              {sent ? "Back to messages" : "Save review"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
