import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { bracketOf } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { useDeck } from "@/lib/deck-store";

export function MemberSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const members = useDeck((state) => state.members);
  const membersStatus = useDeck((state) => state.membersStatus);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((creator) => {
      const channel = creator.channel.toLowerCase();
      const name = creator.name.toLowerCase();
      const place = `${creator.state ?? ""} ${creator.county ?? ""}`.toLowerCase();
      const niche = creator.niches.some((item) => item.toLowerCase().includes(needle));
      return channel.includes(needle) || name.includes(needle) || niche || place.includes(needle);
    });
  }, [members, query]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dashboard-panel rounded-card border border-line bg-ink p-5 text-cream shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-3xl leading-tight">Member Search</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted">
                Find creators by channel name, niche, state, or county.
              </Dialog.Description>
            </div>
            <Dialog.Close className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-line" aria-label="Close search">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <label className="relative mt-5 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Channel, niche, state, or county"
              className="h-12 w-full rounded-control border border-line bg-ink-soft pr-3 pl-10 text-sm text-cream"
            />
          </label>
          <ul className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
            {membersStatus === "loading" ? (
              <li className="text-sm text-muted">Loading creators…</li>
            ) : membersStatus === "auth" ? (
              <li className="text-sm text-muted">Verify via YouTube so search can read the member list.</li>
            ) : results.length === 0 ? (
              <li className="text-sm text-muted">No creators match that search.</li>
            ) : (
              results.map((creator) => (
                <li key={creator.id} className="rounded-control border border-line bg-ink-soft p-3">
                  <p className="font-medium">{creator.channel}</p>
                  <p className="mt-1 text-sm text-muted">
                    {creator.name} · {bracketOf(creator.subscribers).label} · {formatCount(creator.subscribers)} subs
                  </p>
                  {creator.niches.length > 0 || creator.state || creator.county ? (
                    <p className="mt-1 text-sm text-muted">
                      {[
                        creator.county
                          ? /county/i.test(creator.county)
                            ? creator.county
                            : `${creator.county} County`
                          : null,
                        creator.state,
                        ...creator.niches,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
