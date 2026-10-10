/**
 * Invite rewards, stored durably in Firestore (server only).
 *
 * - `referralCodes/{code}`: registered when a verified creator loads their own
 *   invite status; a claim is only accepted for a registered code.
 * - `referralClaims/{refereeChannelId}`: one claim per verified YouTube channel.
 * - `referralRewards/{code}`: invite count and the inviter's Plus end time.
 */
import { INVITE_REWARDS_PER_MONTH, REFERRAL_PLUS_MS, referralCode, rewardMonthKey } from "@/lib/referrals";
import { grantReferralPlus } from "@/lib/stripe-billing.server";
import { PreconditionFailedError, commit, getDocument, runTransaction, safeDocId, type Write } from "@/lib/server/firestore.server";

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Invite-reward Plus end time for `code`, but ONLY when `code` is registered to
 * `channelId`. Codes are slugs of YouTube handles, so different channels can
 * map to the same code (e.g. "@foo.bar", "@foo_bar" and "@foo-bar" all become
 * "foo-bar"), and a handle can be released and taken by another channel. The
 * reward belongs to the channel that registered the code, never to whoever
 * currently has a matching handle.
 */
export async function readReferralReward(code: string, channelId: string): Promise<number> {
  if (!code || !channelId) return 0;
  const owner = await getDocument(`referralCodes/${safeDocId(code)}`);
  if (!owner || owner.channelId !== channelId) return 0;
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
  /** False when the inviter already earned INVITE_REWARDS_PER_MONTH rewards this calendar month. */
  inviterRewarded?: boolean;
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
  const month = rewardMonthKey(new Date(now));
  let inviterRewarded = false;
  try {
    inviterRewarded = await runTransaction<boolean>(async (tx) => {
      const [claim, reward] = await Promise.all([
        tx.get(`referralClaims/${safeDocId(referee.channelId)}`),
        tx.get(`referralRewards/${safeDocId(code)}`),
      ]);
      if (claim) throw new PreconditionFailedError();
      const monthCount = reward?.month === month ? asNumber(reward?.monthCount) : 0;
      const rewarded = monthCount < INVITE_REWARDS_PER_MONTH;
      const current = asNumber(reward?.plusUntil);
      const writes: Write[] = [
        {
          path: `referralClaims/${safeDocId(referee.channelId)}`,
          fields: { code, refereeChannelId: referee.channelId, createdAt: now, inviterRewarded: rewarded },
          precondition: "absent",
        },
        {
          path: `referralRewards/${safeDocId(code)}`,
          fields: {
            code,
            plusUntil: rewarded ? Math.max(now, current) + REFERRAL_PLUS_MS : current,
            month,
            monthCount: rewarded ? monthCount + 1 : monthCount,
            updatedAt: now,
          },
          increment: { invites: 1 },
        },
      ];
      return { writes, result: rewarded };
    });
  } catch (error) {
    if (error instanceof PreconditionFailedError) return { ok: true, already: true, refereePlusUntil: 0 };
    throw error;
  }
  const refereePlusUntil = now + REFERRAL_PLUS_MS;
  await grantReferralPlus(referee.channelId, refereePlusUntil);
  const inviterChannelId = typeof owner.channelId === "string" ? owner.channelId : null;
  return { ok: true, already: false, refereePlusUntil, inviterChannelId: inviterRewarded ? inviterChannelId : null, inviterRewarded };
}
