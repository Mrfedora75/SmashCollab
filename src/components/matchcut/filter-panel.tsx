import { useEffect, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import { Search } from "lucide-react";
import { BRACKETS, NICHES, normalizeFilterNiche } from "@/data/creators";
import { cn } from "@/lib/cn";
import { useDeck, type SortKey } from "@/lib/deck-store";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "fit", label: "Collab fit" },
  { id: "views", label: "Avg views" },
  { id: "subs", label: "Subscribers" },
];

export function FilterPanel() {
  const niches = useDeck((state) => state.niches);
  const minBracket = useDeck((state) => state.minBracket);
  const maxBracket = useDeck((state) => state.maxBracket);
  const sort = useDeck((state) => state.sort);
  const swipes = useDeck((state) => state.swipes);
  const toggleNiche = useDeck((state) => state.toggleNiche);
  const setBrackets = useDeck((state) => state.setBrackets);
  const setSort = useDeck((state) => state.setSort);
  const clearFilters = useDeck((state) => state.clearFilters);
  const resetSwipes = useDeck((state) => state.resetSwipes);
  const [sliderReady, setSliderReady] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSliderReady(true);
  }, []);

  const filtersDirty =
    niches.length > 0 || minBracket !== 0 || maxBracket !== BRACKETS.length - 1 || sort !== "fit";
  const rangeLabel =
    minBracket === maxBracket
      ? BRACKETS[minBracket].label
      : `${BRACKETS[minBracket].label} to ${BRACKETS[maxBracket].label}`;
  const customNiches = niches.filter((niche) => !(NICHES as readonly string[]).includes(niche));

  function addNiche(raw: string) {
    const next = normalizeFilterNiche(raw);
    if (!next) return;
    const current = useDeck.getState().niches;
    if (!current.some((item) => item.toLowerCase() === next.toLowerCase())) toggleNiche(next);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-8 p-5">
      <div>
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Niches</h2>
        <p className="mt-1 text-sm text-muted">Show channels in any selected niche.</p>
        <form
          className="relative mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            addNiche(query);
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add a niche, like Woodworking"
            aria-label="Add a niche"
            maxLength={40}
            className="h-11 w-full rounded-control border border-line bg-transparent pr-3 pl-9 text-sm text-cream outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {customNiches.map((niche) => (
            <span
              key={niche}
              className="inline-flex min-h-11 items-center rounded-full border border-accent bg-accent px-3 text-sm text-on-accent"
            >
              {niche}
            </span>
          ))}
          {NICHES.map((niche) => {
            const on = niches.some((item) => item.toLowerCase() === niche.toLowerCase());
            return (
              <button
                key={niche}
                type="button"
                aria-pressed={on}
                onClick={() => toggleNiche(niche)}
                className={cn(
                  "press min-h-11 rounded-full border px-3 text-sm",
                  on ? "border-accent bg-accent text-on-accent" : "border-line text-cream",
                )}
              >
                {niche}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Channel size</h2>
        <p className="mt-1 text-sm text-cream">{rangeLabel}</p>
        {sliderReady ? (
          <Slider.Root
            className="relative mt-4 flex h-11 w-full touch-none items-center"
            min={0}
            max={BRACKETS.length - 1}
            step={1}
            minStepsBetweenThumbs={0}
            value={[minBracket, maxBracket]}
            onValueChange={([min, max]) => setBrackets(min ?? 0, max ?? BRACKETS.length - 1)}
          >
            <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
              <Slider.Range className="absolute h-full rounded-full bg-accent" />
            </Slider.Track>
            <Slider.Thumb
              aria-label="Minimum channel size"
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="size-5 rounded-full border-2 border-cream bg-accent" />
            </Slider.Thumb>
            <Slider.Thumb
              aria-label="Maximum channel size"
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="size-5 rounded-full border-2 border-cream bg-accent" />
            </Slider.Thumb>
          </Slider.Root>
        ) : (
          <div className="relative mt-4 flex h-11 w-full items-center" aria-hidden="true">
            <div className="relative h-1.5 w-full rounded-full bg-line">
              <div
                className="absolute inset-y-0 rounded-full bg-accent"
                style={{
                  left: `${(minBracket / (BRACKETS.length - 1)) * 100}%`,
                  right: `${100 - (maxBracket / (BRACKETS.length - 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
        <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
          <span>{BRACKETS[0].label}</span>
          <span className="text-center">{BRACKETS[1].label}</span>
          <span className="text-right">{BRACKETS[BRACKETS.length - 1].label}</span>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Sort</h2>
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Sort channels">
          {SORTS.map((option) => {
            const on = sort === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSort(option.id)}
                className={cn(
                  "press min-h-11 rounded-control border px-3 text-left text-sm",
                  on ? "border-cream bg-cream text-ink-text" : "border-line text-cream",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {filtersDirty ? (
          <button
            type="button"
            onClick={clearFilters}
            className="press min-h-11 rounded-control border border-line px-3 text-sm text-cream"
          >
            Clear filters
          </button>
        ) : null}
        {swipes.length > 0 ? (
          <button
            type="button"
            onClick={resetSwipes}
            className="press min-h-11 rounded-control px-3 text-sm text-muted"
          >
            Reset swipes
          </button>
        ) : null}
      </div>
    </div>
  );
}
