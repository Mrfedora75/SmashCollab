import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import { X } from "lucide-react";
import { BRACKETS, LOCATIONS, NICHES, US_STATES, type LocationId, type Niche, type UsState } from "@/data/creators";
import { cn } from "@/lib/cn";
import { useDeck } from "@/lib/deck-store";

export function DiscoveryFilters({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const storedNiches = useDeck((state) => state.niches);
  const storedMin = useDeck((state) => state.minBracket);
  const storedMax = useDeck((state) => state.maxBracket);
  const storedLocation = useDeck((state) => state.location);
  const storedState = useDeck((state) => state.usState);
  const setDiscovery = useDeck((state) => state.setDiscovery);
  const [broad, setBroad] = useState(true);
  const [picked, setPicked] = useState<Niche[]>([...NICHES]);
  const [minBracket, setMinBracket] = useState(0);
  const [maxBracket, setMaxBracket] = useState(BRACKETS.length - 1);
  const [location, setLocation] = useState<LocationId>("global");
  const [usState, setUsState] = useState<UsState | "">("");
  const [sliderReady, setSliderReady] = useState(false);

  useEffect(() => {
    setSliderReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const presets = storedNiches.filter((niche): niche is Niche =>
      (NICHES as readonly string[]).includes(niche),
    );
    const all = presets.length === 0 && storedNiches.length === 0;
    setBroad(all);
    setPicked(all ? [...NICHES] : presets);
    setMinBracket(storedMin);
    setMaxBracket(storedMax);
    setLocation(storedLocation);
    setUsState(storedState ?? "");
  }, [open, storedNiches, storedMin, storedMax, storedLocation, storedState]);

  function toggleBroad() {
    if (broad) {
      setBroad(false);
      setPicked([]);
      return;
    }
    setBroad(true);
    setPicked([...NICHES]);
  }

  function toggleNiche(niche: Niche) {
    if (broad) {
      setBroad(false);
      setPicked(NICHES.filter((item) => item !== niche));
      return;
    }
    const next = picked.includes(niche) ? picked.filter((item) => item !== niche) : [...picked, niche];
    if (next.length === NICHES.length) {
      setBroad(true);
      setPicked([...NICHES]);
      return;
    }
    setPicked(next);
  }

  const anySize = minBracket === 0 && maxBracket === BRACKETS.length - 1;
  const sizeLabel = anySize
    ? "Any Size"
    : minBracket === maxBracket
      ? `${BRACKETS[minBracket].label} · ${BRACKETS[minBracket].range}`
      : `${BRACKETS[minBracket].label} to ${BRACKETS[maxBracket].label}`;

  const needsState = location === "us" || location === "us-state";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dashboard-panel rounded-card border border-line bg-ink p-5 text-cream shadow-card sm:p-6" aria-describedby={undefined}>
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-3xl leading-tight">Discovery Filters</Dialog.Title>
            <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close filters">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <section className="mt-6">
            <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Categories</h2>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-card border border-line bg-ink-soft px-3 py-2">
              <p className="text-sm font-medium">Select All (Broad Match)</p>
              <button
                type="button"
                role="switch"
                aria-checked={broad}
                aria-label="Select All (Broad Match)"
                onClick={toggleBroad}
                className="press flex h-11 w-14 shrink-0 items-center rounded-full px-1"
              >
                <span className={cn("relative h-7 w-12 rounded-full", broad ? "bg-accent" : "bg-muted")}>
                  <span className={cn("absolute top-0.5 size-6 rounded-full bg-cream", broad ? "right-0.5" : "left-0.5")} />
                </span>
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {NICHES.map((niche) => {
                const on = broad || picked.includes(niche);
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
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Channel Size</h2>
            <p className="mt-1 text-sm text-cream">{sizeLabel}</p>
            {sliderReady ? (
              <Slider.Root
                className="relative mt-4 flex h-11 w-full touch-none items-center"
                min={0}
                max={BRACKETS.length - 1}
                step={1}
                minStepsBetweenThumbs={0}
                value={[minBracket, maxBracket]}
                onValueChange={([min, max]) => {
                  setMinBracket(min ?? 0);
                  setMaxBracket(max ?? BRACKETS.length - 1);
                }}
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
                <div className="h-1.5 w-full rounded-full bg-line" />
              </div>
            )}
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>Nano</span>
              <span>Flagship</span>
            </div>
          </section>

          <label className="mt-6 block text-sm" htmlFor="discovery-location">
            Location
            <select
              id="discovery-location"
              value={location}
              onChange={(event) => setLocation(event.target.value as LocationId)}
              className="mt-2 h-12 w-full rounded-control border border-line bg-ink px-3 text-sm text-cream"
            >
              {LOCATIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {needsState ? (
            <label className="mt-3 block text-sm" htmlFor="discovery-state">
              State
              <select
                id="discovery-state"
                value={usState}
                onChange={(event) => setUsState(event.target.value as UsState | "")}
                className="mt-2 h-12 w-full rounded-control border border-line bg-ink px-3 text-sm text-cream"
              >
                <option value="">Select a state</option>
                {US_STATES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            onClick={() => {
              const custom = storedNiches.filter(
                (niche) => !(NICHES as readonly string[]).includes(niche),
              );
              setDiscovery({
                niches: broad ? custom : [...picked, ...custom],
                minBracket,
                maxBracket,
                location,
                usState: needsState && usState ? usState : null,
              });
              onOpenChange(false);
            }}
            className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
          >
            Apply Filters
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
