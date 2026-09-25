import { Lock, Play } from "lucide-react";
import { bracketOf, type Creator } from "@/data/creators";
import { fitLabel, formatCount } from "@/lib/format";
import { StarRow } from "@/components/matchcut/stars";

type CardFaceProps = {
  creator: Creator;
  locked: boolean;
  asHeading?: boolean;
  passOpacity?: number;
  pitchOpacity?: number;
};

export function CardFace({ creator, locked, asHeading = true, passOpacity = 0, pitchOpacity = 0 }: CardFaceProps) {
  const tier = bracketOf(creator.subscribers);

  return (
    <div className="overflow-hidden rounded-card bg-cream text-ink-text shadow-card">
      <div className="relative h-20 bg-ink sm:aspect-video sm:h-auto">
        <img
          src={creator.thumb}
          alt={`${creator.channel}: ${creator.videoTitle}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
        <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-cream text-ink-text">
          <Play className="size-4 translate-x-px" aria-hidden="true" />
        </span>
        <span className="absolute right-3 bottom-3 rounded-control bg-ink px-2 py-1 text-xs font-medium text-cream">
          {creator.duration}
        </span>
        <span
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 rounded-control border-2 border-ink-text bg-cream px-3 py-1 text-sm font-semibold tracking-widest text-ink-text uppercase"
          style={{ opacity: passOpacity }}
          aria-hidden="true"
        >
          Pass
        </span>
        <span
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded-control bg-accent px-3 py-1 text-sm font-semibold tracking-widest text-on-accent uppercase"
          style={{ opacity: pitchOpacity }}
          aria-hidden="true"
        >
          Pitch
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">{tier.label}</p>
          {asHeading ? (
            <h2 className="mt-1 font-display text-3xl leading-tight text-ink-text">{creator.channel}</h2>
          ) : (
            <p className="mt-1 font-display text-3xl leading-tight text-ink-text">{creator.channel}</p>
          )}
          <p className="mt-1 text-sm text-muted-strong">{creator.name}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-y border-cream-deep py-3">
          <div>
            <dt className="text-xs tracking-wide text-muted-strong uppercase">Subscribers</dt>
            <dd className="mt-0.5 text-lg font-medium">{formatCount(creator.subscribers)}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-strong uppercase">Avg views</dt>
            <dd className="mt-0.5 text-lg font-medium">{formatCount(creator.avgViews)}</dd>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-2">
            <dt className="text-xs tracking-wide text-muted-strong uppercase">Collab rating</dt>
            <dd className="flex items-center gap-1.5">
              <StarRow value={creator.rating} />
              <span className="text-sm font-medium">{creator.rating > 0 ? creator.rating.toFixed(1) : "New"}</span>
            </dd>
          </div>
        </dl>
        <ul className="flex flex-wrap gap-2">
          {creator.niches.map((niche) => (
            <li
              key={niche}
              className="rounded-full bg-cream-deep px-3 py-1 text-sm font-medium text-ink-text"
            >
              {niche}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted-strong">
          <span className="font-medium text-ink-text">
            {creator.fit} · {fitLabel(creator.fit)}
          </span>
          {" · "}
          Open to {creator.openTo.toLowerCase()}.
        </p>
        <div className="border-t border-cream-deep pt-3">
          <p className="text-xs font-medium tracking-widest text-muted-strong uppercase">Latest</p>
          <p className="mt-1 text-sm font-medium">{creator.videoTitle}</p>
          {locked ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-accent-deep">
              <Lock className="size-3.5" aria-hidden="true" />
              Plus to pitch this flagship channel
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
