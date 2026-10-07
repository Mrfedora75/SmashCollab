import { bracketOf } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { useDeck } from "@/lib/deck-store";
import { PlusBadge } from "@/components/matchcut/plus-badge";

export function CollabTray({ idPrefix = "note", heading = true }: { idPrefix?: string; heading?: boolean }) {
  const swipes = useDeck((state) => state.swipes);
  const members = useDeck((state) => state.members);
  const notes = useDeck((state) => state.notes);
  const setNote = useDeck((state) => state.setNote);
  const removeSwipe = useDeck((state) => state.removeSwipe);
  const collabs = swipes.filter((swipe) => swipe.direction === "pitch").slice().reverse();

  return (
    <div className="flex h-full flex-col">
      {heading ? (
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-2xl leading-tight">Collabs</h2>
          <p className="mt-1 text-sm text-muted">They see your collab in their inbox. If they send one back, you match.</p>
        </div>
      ) : null}
      {collabs.length === 0 ? (
        <p className="px-5 py-6 text-sm leading-relaxed text-muted">
          Swipe a card right to queue a collab. You can edit the note before you would send it.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 overflow-y-auto p-5">
          {collabs.map((swipe) => {
            const creator = members.find((item) => item.id === swipe.creatorId);
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
                    <p className="flex min-w-0 items-center gap-1 font-medium">
                      <span className="truncate">{creator.channel}</span>
                      {creator.plus ? <PlusBadge /> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {tier.label} · {formatCount(creator.subscribers)}
                    </p>
                  </div>
                </div>
                <label className="mt-3 block text-xs tracking-widest text-muted uppercase" htmlFor={`${idPrefix}-${creator.id}`}>
                  Collab note
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
