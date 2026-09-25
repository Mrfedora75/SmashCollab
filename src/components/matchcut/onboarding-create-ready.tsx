import type { Dispatch, SetStateAction } from "react";
import { Check } from "lucide-react";
import { NICHES } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { VerifiedChannel } from "@/components/matchcut/onboarding-storage";

export function CreateReadyView({
  verified,
  picked,
  menuOpen,
  setMenuOpen,
  toggle,
  onEnter,
}: {
  verified: VerifiedChannel;
  picked: string[];
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  toggle: (niche: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="mt-6 text-left">
      <p
        className="text-center text-xs font-medium tracking-widest text-muted-strong uppercase"
        role="status"
      >
        Channel verified
      </p>
      <div className="mt-3 flex flex-col items-center gap-2">
        {verified.avatar ? (
          <img
            src={verified.avatar}
            alt=""
            className="size-16 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <p className="font-display text-3xl leading-tight">{verified.channel}</p>
        <p className="text-sm text-muted-strong">
          {formatCount(verified.subscribers)} subscribers | read-only
        </p>
      </div>
      <div className="relative mt-6">
        <p id="niche-label" className="text-sm font-medium">
          Niche tags
        </p>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-labelledby="niche-label"
          onClick={() => setMenuOpen((open) => !open)}
          className="press mt-2 flex h-12 w-full items-center justify-between rounded-control border border-cream-deep px-3 text-left text-sm"
        >
          <span className={picked.length === 0 ? "text-muted-strong" : ""}>
            {picked.length === 0 ? "Select niche tags" : picked.join(", ")}
          </span>
          <span aria-hidden="true">{menuOpen ? "-" : "+"}</span>
        </button>
        {menuOpen ? (
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby="niche-label"
            className="mt-2 max-h-48 overflow-auto rounded-control border border-cream-deep"
          >
            {NICHES.map((niche) => {
              const on = picked.includes(niche);
              return (
                <li key={niche}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(niche)}
                    className={cn(
                      "press flex h-11 w-full items-center justify-between px-3 text-left text-sm",
                      on && "bg-cream-deep",
                    )}
                  >
                    {niche}
                    {on ? <Check className="size-4 text-accent-deep" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        disabled={picked.length === 0}
        onClick={onEnter}
        className="press mt-5 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
      >
        Enter the desk
      </button>
    </div>
  );
}
