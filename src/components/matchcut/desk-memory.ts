import type { AcceptedCollab, BlockedCreator, ChatMessage, InboundPitch } from "@/data/inbox";
import type { SavedReview } from "@/components/matchcut/review-modal";

const KEY = "matchcut-desk";

export type DeskMemory = {
  pending: InboundPitch[];
  accepted: AcceptedCollab[];
  threads: Record<string, ChatMessage[]>;
  blocked: BlockedCreator[];
  reviews: Record<string, SavedReview>;
};

function isPitch(value: unknown): value is InboundPitch {
  if (!value || typeof value !== "object") return false;
  const pitch = value as InboundPitch;
  return typeof pitch.creatorId === "string" && typeof pitch.message === "string" && typeof pitch.title === "string" && typeof pitch.ago === "string";
}

function isCollab(value: unknown): value is AcceptedCollab {
  if (!value || typeof value !== "object") return false;
  const collab = value as AcceptedCollab;
  return typeof collab.id === "string" && typeof collab.creatorId === "string" && typeof collab.title === "string" && typeof collab.when === "string" && typeof collab.summary === "string";
}

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as ChatMessage;
  return typeof message.id === "string" && (message.from === "them" || message.from === "you") && typeof message.text === "string";
}

export function loadDeskMemory(): DeskMemory | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeskMemory>;
    const pending = Array.isArray(parsed.pending) ? parsed.pending.filter(isPitch) : [];
    const accepted = Array.isArray(parsed.accepted) ? parsed.accepted.filter(isCollab) : [];
    const threads: Record<string, ChatMessage[]> = {};
    if (parsed.threads && typeof parsed.threads === "object") {
      for (const [id, messages] of Object.entries(parsed.threads)) {
        if (Array.isArray(messages)) threads[id] = messages.filter(isMessage);
      }
    }
    const blocked = Array.isArray(parsed.blocked)
      ? parsed.blocked.filter((item): item is BlockedCreator => {
          if (!item || typeof item !== "object") return false;
          const record = item as BlockedCreator;
          return typeof record.creatorId === "string" && typeof record.channel === "string" && isCollab(record.collab) && Array.isArray(record.messages) && record.messages.every(isMessage);
        })
      : [];
    const reviews: Record<string, SavedReview> = {};
    if (parsed.reviews && typeof parsed.reviews === "object") {
      for (const [id, review] of Object.entries(parsed.reviews)) {
        if (!review || typeof review !== "object") continue;
        const saved = review as SavedReview;
        if (typeof saved.stars === "number" && typeof saved.note === "string") reviews[id] = saved;
      }
    }
    return { pending, accepted, threads, blocked, reviews };
  } catch {
    return null;
  }
}

export function saveDeskMemory(memory: DeskMemory) {
  localStorage.setItem(KEY, JSON.stringify(memory));
}
