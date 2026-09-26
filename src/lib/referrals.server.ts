/**
 * Invite rewards, stored durably in Firestore (server only).
 *
 * - `referralCodes/{code}`: registered when a verified creator loads their own
 *   invite status; a claim is only accepted for a registered code.
 * - `referralClaims/{refereeChannelId}`: one claim per verified YouTube channel.
 * - `referralRewards/{code}`: invite count and the inviter's Plus end time.
 */
import { REFERRAL_PLUS_MS, referralCode } from "@/lib/referrals";
import { grantReferralPlus } from "@/lib/stripe-billing.server";
import { PreconditionFailedError, commit, getDocument, safeDocId } from "@/lib/server/firestore.server";

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function readReferralReward(code: string): Promise<number> {
  const doc = await getDocument(`referralRewards/${safeDocId(code)}`);
  return asNumber(doc?.plusUntil);
}

export async function registerReferralCode(code: string, channelId: string): Promise<void> {
  const existing = await getDocument(`referralCodes/${safeDocId(code)}`);
  if (existing) return;
  try {
    await commit([
      { path: `referralCodes/${safeDocId(code)}`, fields: { code, channelId, createdAt: Date.now() }, precondition: "absent" },
    ]);
  } catch (error) {
    if (!(error instanceof PreconditionFailedError)) throw error;
  }
}

export async function referralStatus(code: string): Promise<{ invites: number; plusUntil: number }> {
  if (!code) return { invites: 0, plusUntil: 0 };
  const doc = await getDocument(`referralRewards/${safeDocId(code)}`);
  return { invites: asNumber(doc?.invites), plusUntil: asNumber(doc?.plusUntil) };
}

export type ClaimResult = {
  ok: boolean;
  already: boolean;
  refereePlusUntil: number;
  /** Channel that owns the invite code (its Plus was extended). */
  inviterChannelId?: string | null;
  reason?: "self" | "unknown-code" | "invalid";
};

export async function claimReferral(rawCode: string, referee: { channelId: string; channel: string | null }): Promise<ClaimResult> {
  const code = referralCode(rawCode);
  if (!code) return { ok: false, already: false, refereePlusUntil: 0, reason: "invalid" };
  if (referee.channel && referralCode(referee.channel) === code) {
    return { ok: false, already: false, refereePlusUntil: 0, reason: "self" };
  }
  const owner = await getDocument(`referralCodes/${safeDocId(code)}`);
  if (!owner || owner.channelId === referee.channelId) {
    return { ok: false, already: false, refereePlusUntil: 0, reason: owner ? "self" : "unknown-code" };
  }
  const now = Date.now();
  const reward = await getDocument(`referralRewards/${safeDocId(code)}`);
  const current = asNumber(reward?.plusUntil);
  const inviterUntil = Math.max(now, current) + REFERRAL_PLUS_MS;
  try {
    await commit([
      {
        path: `referralClaims/${safeDocId(referee.channelId)}`,
        fields: { code, refereeChannelId: referee.channelId, createdAt: now },
        precondition: "absent",
      },
      {
        path: `referralRewards/${safeDocId(code)}`,
        fields: { code, plusUntil: inviterUntil, updatedAt: now },
        increment: { invites: 1 },
      },
    ]);
  } catch (error) {
    if (error instanceof PreconditionFailedError) return { ok: true, already: true, refereePlusUntil: 0 };
    throw error;
  }
  const refereePlusUntil = now + REFERRAL_PLUS_MS;
  await grantReferralPlus(referee.channelId, refereePlusUntil);
  const inviterChannelId = typeof owner.channelId === "string" ? owner.channelId : null;
  return { ok: true, already: false, refereePlusUntil, inviterChannelId };
}
