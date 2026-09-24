import { CREATORS, bracketOf } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { useDeck } from "@/lib/deck-store";

export function PitchTray({ idPrefix = "note", heading = true }: { idPrefix?: string; heading?: boolean }) {
  const swipes = useDeck((state) => state.swipes);
  const notes = useDeck((state) => state.notes);
  const setNote = useDeck((state) => state.setNote);
  const removeSwipe = useDeck((state) => state.removeSwipe);
  const pitches = swipes.filter((swipe) => swipe.direction === "pitch").slice().reverse();

  return (
    <div className="flex h-full flex-col">
      {heading ? (
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-2xl leading-tight">Pitches</h2>
          <p className="mt-1 text-sm text-muted">Queued on this desk. Nothing is emailed.</p>
        </div>
      ) : null}
      {pitches.length === 0 ? (
        <p className="px-5 py-6 text-sm leading-relaxed text-muted">
          Swipe a card right to queue a pitch. You can edit the note before you would send it.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 overflow-y-auto p-5">
          {pitches.map((swipe) => {
            const creator = CREATORS.find((item) => item.id === swipe.creatorId);
            if (!creator) return null;
            const tier = bracketOf(creator.subscribers);
            return (
              <li key={swipe.creatorId} className="rounded-card border border-line bg-ink-soft p-3">
                <div className="flex gap-3">
                  <img
                    src={creator.thumb}
                    alt=""
                    className="h-14 w-24 shrink-0 rounded-control object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{creator.channel}</p>
                    <p className="text-sm text-muted">
                      {tier.label} · {formatCount(creator.subscribers)}
                    </p>
                  </div>
                </div>
                <label className="mt-3 block text-xs tracking-widest text-muted uppercase" htmlFor={`${idPrefix}-${creator.id}`}>
                  Pitch note
                </label>
                <textarea
                  id={`${idPrefix}-${creator.id}`}
                  rows={4}
                  value={notes[creator.id] ?? ""}
                  onChange={(event) => setNote(creator.id, event.target.value)}
                  className="mt-1 w-full resize-none rounded-control border border-line bg-ink px-3 py-2 text-sm leading-relaxed text-cream"
                />
                <button
                  type="button"
                  onClick={() => removeSwipe(creator.id)}
                  className="press mt-2 min-h-11 text-sm text-muted"
                >
                  Pull back into the deck
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
