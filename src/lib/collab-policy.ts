/**
 * Collab limits, shared by the server (which enforces them in /api/collab) and
 * the browser (which only uses them to show the right prompt up front).
 */
import { FREE_DAILY, PLUS_SUBSCRIBER_MIN } from "@/data/creators";

export type CollabRefusal = "over_limit" | "target_unverified" | "daily_limit";

export type CollabDecision =
  | { allowed: true; useCredit: boolean; countsAsFree: boolean }
  | { allowed: false; code: CollabRefusal };

export const COLLAB_MESSAGES: Record<CollabRefusal, string> = {
  over_limit: "This channel is over 5K — upgrade to Plus or use a $1 collab.",
  target_unverified:
    "This channel hasn't verified its subscriber count yet — upgrade to Plus or use a $1 collab.",
  daily_limit: "You've used today's free collabs — upgrade to Plus or use a $1 collab.",
};

/** Server day for the free-collab counter (UTC). */
export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * - Plus: always allowed, nothing is spent.
 * - Free, target under 5K and under today's free limit: allowed, counts as a free collab.
 * - Otherwise one purchased $1 collab credit is spent, or the collab is refused.
 * A target without a server-verified subscriber count is treated as over the limit.
 */
export function decideCollab(input: {
  plus: boolean;
  targetSubscribers: number | null;
  freeUsedToday: number;
  credits: number;
  dailyLimit?: number;
  subscriberLimit?: number;
}): CollabDecision {
  if (input.plus) return { allowed: true, useCredit: false, countsAsFree: false };
  const dailyLimit = input.dailyLimit ?? FREE_DAILY;
  const subscriberLimit = input.subscriberLimit ?? PLUS_SUBSCRIBER_MIN;
  const unverified = input.targetSubscribers == null;
  const overSubs = unverified || (input.targetSubscribers as number) >= subscriberLimit;
  const overDaily = input.freeUsedToday >= dailyLimit;
  if (!overSubs && !overDaily) return { allowed: true, useCredit: false, countsAsFree: true };
  if (input.credits > 0) return { allowed: true, useCredit: true, countsAsFree: false };
  if (overSubs) return { allowed: false, code: unverified ? "target_unverified" : "over_limit" };
  return { allowed: false, code: "daily_limit" };
}
