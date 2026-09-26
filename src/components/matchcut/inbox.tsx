import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Lock, MoreVertical, X } from "lucide-react";
import type { Creator } from "@/data/creators";
import { type AcceptedCollab, type ChatMessage, type InboundPitch } from "@/data/inbox";
import type { SavedReview } from "@/components/matchcut/review-modal";
import { StarRow } from "@/components/matchcut/stars";
import { cn } from "@/lib/cn";

export type OutboundPitch = {
  creatorId: string;
  message: string;
  status: "pending" | "accepted";
};

export function Inbox({
  pending,
  accepted,
  outbound,
  premium,
  reviews,
  onAccept,
  onDecline,
  onOpen,
  onReview,
  onUpgrade,
  lookup,
  heading = true,
}: {
  lookup: (creatorId: string) => Creator | undefined;
  pending: InboundPitch[];
  accepted: AcceptedCollab[];
  outbound: OutboundPitch[];
  premium: boolean;
  reviews: Record<string, SavedReview>;
  onAccept: (pitch: InboundPitch) => void;
  onDecline: (creatorId: string) => void;
  onOpen: (collabId: string) => void;
  onReview: (collabId: string) => void;
  onUpgrade: () => void;
  heading?: boolean;
}) {
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const locked = !premium;

  return (
    <div className="flex h-full flex-col">
      {heading ? (
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-2xl leading-tight">Matches & Messages</h2>
          <p className="mt-1 text-sm text-muted">When you and another creator both pitch, you match and can message.</p>
        </div>
      ) : (
        <p className="px-5 pt-4 text-sm text-muted">When you and another creator both pitch, you match and can message.</p>
      )}
      <div className="grid grid-cols-2 gap-1 px-5 pt-4" role="tablist" aria-label="Messages">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "inbound"}
          onClick={() => setTab("inbound")}
          className={cn(
            "press h-11 rounded-control text-sm",
            tab === "inbound" ? "bg-cream font-medium text-ink-text" : "border border-line",
          )}
        >
          Inbound
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "outbound"}
          onClick={() => setTab("outbound")}
          className={cn(
            "press h-11 rounded-control text-sm",
            tab === "outbound" ? "bg-cream font-medium text-ink-text" : "border border-line",
          )}
        >
          Outbound
        </button>
      </div>
      <div className="flex flex-col gap-6 overflow-y-auto p-5">
        {tab === "inbound" ? (
          <>
            <section>
              <h3 className="text-xs font-medium tracking-widest text-muted uppercase">Pending inbound</h3>
              {pending.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No pitches waiting.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {pending.map((pitch) => {
                    const creator = lookup(pitch.creatorId);
                    if (!creator) return null;
                    if (locked) {
                      return (
                        <li key={pitch.creatorId}>
                          <button
                            type="button"
                            onClick={onUpgrade}
                            className="press relative w-full overflow-hidden rounded-card border border-line bg-ink-soft p-3 text-left"
                          >
                            <div className="pointer-events-none blur-2xl select-none" aria-hidden="true">
                              <div className="flex gap-3">
                                <img src={creator.thumb} alt="" className="h-14 w-24 shrink-0 rounded-control object-cover" />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{creator.channel}</p>
                                  <p className="text-sm text-muted">
                                    {creator.name} · {pitch.ago}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-3 text-sm leading-relaxed text-cream">{pitch.message}</p>
                            </div>
                            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/80 px-4 text-center">
                              <Lock className="size-5 text-cream" aria-hidden="true" />
                              <span className="text-sm leading-relaxed">
                                Upgrade to Premium to see who pitched you and reply.
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={pitch.creatorId} className="rounded-card border border-line bg-ink-soft p-3">
                        <div className="flex gap-3">
                          <img src={creator.thumb} alt="" className="h-14 w-24 shrink-0 rounded-control object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{creator.channel}</p>
                            <p className="text-sm text-muted">
                              {creator.name} · {pitch.ago}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-cream">{pitch.message}</p>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onDecline(pitch.creatorId)}
                            className="press flex h-11 items-center gap-2 rounded-full border border-line px-3 text-sm"
                          >
                            <X className="size-4" aria-hidden="true" />
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => onAccept(pitch)}
                            className="press flex h-11 items-center gap-2 rounded-full bg-accent px-3 text-sm font-medium text-on-accent"
                          >
                            <Check className="size-4" aria-hidden="true" />
                            Accept
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section>
              <h3 className="text-xs font-medium tracking-widest text-muted uppercase">Matches</h3>
              {accepted.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No matches yet. Pitch creators from the desk, or accept a pitch above.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {accepted.map((collab) => {
                    const creator = lookup(collab.creatorId);
                    const review = reviews[collab.id];
                    if (!creator) return null;
                    return (
                      <li key={collab.id} className="rounded-card border border-line bg-ink-soft p-3">
                        <button type="button" onClick={() => onOpen(collab.id)} className="press w-full text-left">
                          <p className="font-medium">{collab.title}</p>
                          <p className="mt-1 text-sm text-muted">
                            {creator.channel} · {collab.when}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed">{collab.summary}</p>
                          <p className="mt-2 text-sm text-cream">Open thread</p>
                        </button>
                        {review ? (
                          <p className="mt-3 flex items-center gap-2 text-sm text-cream">
                            <StarRow value={review.stars} />
                            <span>Your review, {review.stars} of 5</span>
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onReview(collab.id)}
                            className="press mt-3 h-11 rounded-control border border-line px-3 text-sm"
                          >
                            Leave a Review
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section>
            <h3 className="text-xs font-medium tracking-widest text-muted uppercase">Sent pitches</h3>
            {outbound.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No pitches sent yet. Pitch a channel from the desk.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {outbound.map((pitch) => {
                  const creator = lookup(pitch.creatorId);
                  if (!creator) return null;
                  const acceptedPitch = pitch.status === "accepted";
                  return (
                    <li key={pitch.creatorId} className="rounded-card border border-line bg-ink-soft p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-medium">{creator.channel}</p>
                        <p className={cn("shrink-0 text-sm font-medium", acceptedPitch ? "text-status-accepted" : "text-status-pending")}>
                          {acceptedPitch ? "Accepted" : "Pending"}
                        </p>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-cream">
                        {pitch.message || "Pitch queued."}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function ChatThread({
  collab,
  creator,
  messages,
  error,
  onClose,
  onSend,
  onBlock,
}: {
  collab: AcceptedCollab | null;
  creator: Creator | undefined;
  messages: ChatMessage[];
  error?: string | null;
  onClose: () => void;
  onSend: (text: string) => void;
  onBlock: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setDraft("");
    setMenuOpen(false);
    setConfirm(false);
  }, [collab?.id]);

  return (
    <>
    <Dialog.Root open={collab != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer drawer-right drawer-chat border-l border-line bg-ink" aria-describedby={undefined}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate font-display text-2xl">{collab?.title ?? "Thread"}</Dialog.Title>
              <p className="truncate text-sm text-muted">{creator ? creator.channel : "Collab thread"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Dialog.Close
                className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-line"
                aria-label="Close thread"
              >
                <X className="size-4" />
              </Dialog.Close>
              <div className="relative">
                <button
                  type="button"
                  aria-label="More options"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="press flex size-11 items-center justify-center rounded-full border border-line"
                >
                  <MoreVertical className="size-4" aria-hidden="true" />
                </button>
                {menuOpen ? (
                  <div role="menu" className="absolute right-0 z-10 mt-2 w-40 rounded-control border border-line bg-ink-soft py-1 shadow-card">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirm(true);
                      }}
                      className="press flex h-11 w-full items-center px-3 text-left text-sm text-accent"
                    >
                      Block User
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
            {error ? (
              <p className="text-sm text-accent" role="alert">
                {error}
              </p>
            ) : null}
            {messages.length === 0 && !error ? (
              <p className="text-sm text-muted">You matched! Say hi and plan the collab.</p>
            ) : null}
            {messages.map((message) => (
              <p
                key={message.id}
                className={
                  message.from === "you"
                    ? "ml-8 rounded-card bg-cream px-3 py-2 text-sm leading-relaxed text-ink-text"
                    : "mr-8 rounded-card border border-line bg-ink-soft px-3 py-2 text-sm leading-relaxed"
                }
              >
                <span className="mb-1 block text-xs font-medium tracking-wide uppercase opacity-70">
                  {message.from === "you" ? "You" : creator?.name ?? "Them"}
                </span>
                {message.text}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-line p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              onSend(text);
              setDraft("");
            }}
          >
            <label htmlFor="chat-draft" className="sr-only">
              Message
            </label>
            <input
              id="chat-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              placeholder="Coordinate the collab"
              className="h-12 min-w-0 flex-1 rounded-control border border-line bg-ink px-3 text-sm text-cream placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={draft.trim().length === 0}
              className="press h-12 shrink-0 rounded-control bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root open={confirm && collab != null} onOpenChange={(open) => !open && setConfirm(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-scrim" />
        <Dialog.Content className="confirm-panel rounded-card border border-line bg-ink p-5 shadow-card">
          <Dialog.Title className="font-display text-3xl leading-tight">Block this creator?</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted">
            Are you sure you want to block this creator? They will no longer be able to message you or see your profile.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="press h-11 rounded-control border border-line px-4 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm(false);
                onBlock();
              }}
              className="press h-11 rounded-control bg-accent px-4 text-sm font-medium text-on-accent"
            >
              Block
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
