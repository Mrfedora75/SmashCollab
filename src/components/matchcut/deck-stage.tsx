import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, X } from "lucide-react";
import { FREE_DAILY, isPlusChannel } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { useDeck, visibleCreators, type Direction } from "@/lib/deck-store";
import { CardFace } from "@/components/matchcut/card-face";

const THRESHOLD = 110;

export function DeckStage({ channel, subscribers }: { channel: string; subscribers: number }) {
  const niches = useDeck((state) => state.niches);
  const minBracket = useDeck((state) => state.minBracket);
  const maxBracket = useDeck((state) => state.maxBracket);
  const sort = useDeck((state) => state.sort);
  const location = useDeck((state) => state.location);
  const usState = useDeck((state) => state.usState);
  const swipes = useDeck((state) => state.swipes);
  const members = useDeck((state) => state.members);
  const membersStatus = useDeck((state) => state.membersStatus);
  const authError = useDeck((state) => state.authError);
  const premium = useDeck((state) => state.premium);
  const { unseen, matchCount } = visibleCreators({ niches, minBracket, maxBracket, location, usState, sort, swipes }, members);
  const top = unseen[0];
  const behind = unseen.slice(1, 3);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const topRef = useRef(top);
  topRef.current = top;
  const leavingRef = useRef<Direction | null>(null);
  const finishRef = useRef<(direction: Direction) => void>(() => {});

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setLeaving(null);
    leavingRef.current = null;
  }, [top?.id]);

  function finish(direction: Direction) {
    const current = topRef.current;
    if (!current || leavingRef.current) return;
    const gate = useDeck.getState().gateFor(current, direction);
    if (gate) {
      setDragging(false);
      requestAnimationFrame(() => setOffset({ x: 0, y: 0 }));
      useDeck.getState().openPremium(gate);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      useDeck.getState().commit(current.id, direction);
      return;
    }
    leavingRef.current = direction;
    setDragging(false);
    requestAnimationFrame(() => setLeaving(direction));
  }
  finishRef.current = finish;

  function onTransitionEnd(event: React.TransitionEvent<HTMLElement>) {
    if (event.propertyName !== "transform" || !leavingRef.current) return;
    const direction = leavingRef.current;
    const current = topRef.current;
    leavingRef.current = null;
    setLeaving(null);
    setOffset({ x: 0, y: 0 });
    if (current) useDeck.getState().commit(current.id, direction);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        finishRef.current("pass");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        finishRef.current("pitch");
      } else if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        useDeck.getState().undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const passOpacity = leaving === "pass" ? 1 : Math.max(0, Math.min(1, -offset.x / 90));
  const pitchOpacity = leaving === "pitch" ? 1 : Math.max(0, Math.min(1, offset.x / 90));
  const locked = !!top && !premium && isPlusChannel(top.subscribers);
  const transform = leaving
    ? `translateX(${leaving === "pitch" ? "130%" : "-130%"}) rotate(${leaving === "pitch" ? 12 : -12}deg)`
    : `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 18}deg)`;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-4 py-2 sm:py-4">
      <p className="mb-3 text-center text-sm text-muted">
        {unseen.length > 0
          ? `${unseen.length} in your deck · pitching as ${channel}`
          : `Pitching as ${channel} · ${formatCount(subscribers)}`}
      </p>

      <div className="relative pb-6">
        {behind.map((creator, index) => {
          const depth = leaving ? index : index + 1;
          return (
            <div
              key={creator.id}
              aria-hidden="true"
              className="absolute inset-x-0 top-0"
              style={{
                transform: `translateY(${depth * 14}px)`,
                zIndex: 14 - index,
                transition: "transform 280ms cubic-bezier(0.2, 0, 0, 1)",
              }}
            >
              <CardFace
                creator={creator}
                asHeading={false}
                locked={!premium && isPlusChannel(creator.subscribers)}
              />
            </div>
          );
        })}

        {top ? (
          <article
            className="relative z-20 touch-none select-none"
            style={{
              transform,
              transition: dragging ? "none" : "transform 280ms cubic-bezier(0.2, 0, 0, 1)",
            }}
            onTransitionEnd={onTransitionEnd}
            onPointerDown={(event) => {
              if (event.button !== 0 || leavingRef.current) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              origin.current = { x: event.clientX, y: event.clientY };
              setDragging(true);
            }}
            onPointerMove={(event) => {
              if (!dragging || leavingRef.current) return;
              const x = event.clientX - origin.current.x;
              const y = (event.clientY - origin.current.y) * 0.25;
              setOffset({ x, y });
            }}
            onPointerUp={(event) => {
              if (!dragging) return;
              const x = event.clientX - origin.current.x;
              if (x > THRESHOLD) finish("pitch");
              else if (x < -THRESHOLD) finish("pass");
              else {
                setDragging(false);
                requestAnimationFrame(() => setOffset({ x: 0, y: 0 }));
              }
            }}
            onPointerCancel={() => {
              setDragging(false);
              requestAnimationFrame(() => setOffset({ x: 0, y: 0 }));
            }}
          >
            <CardFace creator={top} locked={locked} passOpacity={passOpacity} pitchOpacity={pitchOpacity} />
          </article>
        ) : (
          <div className="rounded-card border border-line bg-ink-soft px-6 py-12 text-center">
            <h2 className="font-display text-3xl">
              {membersStatus === "loading"
                ? "Loading creators"
                : membersStatus === "auth"
                  ? "Google sign-in needed"
                  : membersStatus === "error"
                    ? "Couldn't load creators"
                    : members.length === 0
                      ? "You're early!"
                      : matchCount === 0
                        ? "Nothing in this bracket."
                        : "That's everyone for now."}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {authError
                ? authError
                : membersStatus === "loading"
                ? "Pulling live profiles from the member list."
                : membersStatus === "auth"
                  ? "Verify via YouTube so this desk can read other creators."
                  : membersStatus === "error"
                    ? "The member list did not load. Refresh and try again."
                    : members.length === 0
                      ? "You're one of the first creators here. As other creators verify their channels they'll show up in your deck. Invite creators you'd like to work with!"
                      : matchCount === 0
                        ? "Widen the niches or the channel-size range to bring cards back."
                        : "You've passed or pitched everyone who matches. Reset swipes, or loosen the filters."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => finish("pass")}
          disabled={!top || !!leaving}
          className="press flex h-14 items-center justify-center gap-2 rounded-control border border-line text-sm disabled:opacity-40"
        >
          <X className="size-4" aria-hidden="true" />
          Pass
        </button>
        <button
          type="button"
          onClick={() => useDeck.getState().undo()}
          disabled={swipes.length === 0 || !!leaving}
          className="press flex h-14 items-center justify-center gap-2 rounded-control border border-line text-sm text-muted disabled:opacity-40"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Undo
        </button>
        <button
          type="button"
          onClick={() => finish("pitch")}
          disabled={!top || !!leaving}
          className="press flex h-14 items-center justify-center gap-2 rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden="true" />
          Pitch
        </button>
      </div>
      <p className="mt-3 hidden text-center text-xs text-muted md:block">
        Drag the card, or use the arrow keys. Z brings the last one back. Free desks get {FREE_DAILY} pitches a day.
      </p>
    </div>
  );
}
