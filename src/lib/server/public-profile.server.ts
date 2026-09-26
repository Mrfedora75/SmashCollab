/**
 * Server-controlled fields on public creator profiles (`users/{uid}`).
 *
 * The browser can never write these (see firestore.rules); only this module,
 * using the service account, does:
 *   subscriberCount / subscribers   from the YouTube Data API at verify time
 *   verifiedChannelId / subsVerifiedAt
 *   plus / plusUntil                mirrors the channel's Plus entitlement
 *
 * `channels/{channelId}` (server-only) holds the last YouTube-verified stats for
 * a channel and which Firebase uid it is linked to, so entitlement changes
 * (Stripe webhook, invites, comp) can be mirrored onto the right profile.
 */
import { commit, getDocument, safeDocId, type Plain } from "@/lib/server/firestore.server";
import type { FirebaseIdentity } from "@/lib/server/firebase-auth.server";
import { resolveStoredPlus, type PlusStatus, type YtAccount } from "@/lib/youtube/plus-entitlement";

export type ChannelRecord = {
  channelId: string;
  channel: string | null;
  email: string | null;
  /** null when the channel hides its subscriber count or it has never been verified. */
  subscriberCount: number | null;
  uid: string | null;
};

export function channelPath(channelId: string): string {
  return `channels/${safeDocId(channelId)}`;
}

export function userPath(uid: string): string {
  return `users/${safeDocId(uid)}`;
}

function str(value: Plain | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function readChannelRecord(channelId: string, get = getDocument): Promise<ChannelRecord | null> {
  const doc = await get(channelPath(channelId));
  if (!doc) return null;
  const subs = doc.subscriberCount;
  return {
    channelId,
    channel: str(doc.channel),
    email: str(doc.email),
    subscriberCount: typeof subs === "number" && Number.isFinite(subs) && subs >= 0 ? Math.floor(subs) : null,
    uid: str(doc.uid),
  };
}

/** Called from the YouTube OAuth callback with numbers read from the YouTube Data API. */
export async function recordVerifiedChannel(channel: {
  channelId: string;
  channel: string;
  email: string | null;
  subscribers: number;
  subscribersHidden?: boolean;
  avgViews: number;
}): Promise<void> {
  await commit([
    {
      path: channelPath(channel.channelId),
      fields: {
        channelId: channel.channelId,
        channel: channel.channel,
        email: channel.email,
        subscriberCount: channel.subscribersHidden ? null : Math.max(0, Math.floor(channel.subscribers)),
        avgViews: Math.max(0, Math.floor(channel.avgViews)),
        verifiedAt: Date.now(),
      },
    },
  ]);
}

function publicPlusFields(status: Pick<PlusStatus, "premium" | "premiumUntil">): Record<string, Plain> {
  const on = status.premium && typeof status.premiumUntil === "number" && status.premiumUntil > Date.now();
  return { plus: on, plusUntil: on ? Math.floor(status.premiumUntil as number) : null, plusSyncedAt: Date.now() };
}

function accountFor(record: ChannelRecord): YtAccount {
  return { channelId: record.channelId, channel: record.channel, email: record.email };
}

/**
 * Mirror a channel's current Plus status onto its linked profile. Safe to call
 * after any entitlement change; never creates a profile. Returns false when
 * there is no linked profile (or storage is unavailable).
 */
export async function syncPublicPlus(channelId: string | null | undefined, known?: PlusStatus): Promise<boolean> {
  if (!channelId) return false;
  try {
    const record = await readChannelRecord(channelId);
    if (!record?.uid) return false;
    const status = known ?? (await resolveStoredPlus(accountFor(record)));
    await commit([{ path: userPath(record.uid), fields: publicPlusFields(status), precondition: "exists" }]);
    return true;
  } catch {
    return false;
  }
}

export class ProfileBindError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProfileBindError";
  }
}

export type BindResult = {
  channelId: string;
  subscriberCount: number | null;
  plus: PlusStatus;
};

/**
 * Link a signed-in Firebase user to the YouTube channel proven by the signed
 * session cookie, then write the server-controlled profile fields. The
 * Firebase account and the YouTube grant must be the same Google account
 * whenever both carry an email.
 */
export async function bindProfileToChannel(identity: FirebaseIdentity, account: YtAccount): Promise<BindResult> {
  if (account.email && identity.email && account.email.toLowerCase() !== identity.email.toLowerCase()) {
    throw new ProfileBindError("This YouTube channel was verified with a different Google account.", 403);
  }
  const profile = await getDocument(userPath(identity.uid));
  if (!profile) throw new ProfileBindError("Create your profile first.", 409);
  const record = await readChannelRecord(account.channelId);
  const status = await resolveStoredPlus(account);
  const subscriberCount = record?.subscriberCount ?? null;
  const fields: Record<string, Plain> = {
    verifiedChannelId: account.channelId,
    ...publicPlusFields(status),
  };
  if (record) {
    // null = the channel hides its count; free pitches to it are then refused (fail closed).
    fields.subscriberCount = subscriberCount;
    fields.subsVerifiedAt = Date.now();
    // Legacy display field, overwritten so an old browser-written value can't linger.
    if (subscriberCount != null) fields.subscribers = subscriberCount;
  }
  const channelFields: Record<string, Plain> = { channelId: account.channelId, uid: identity.uid, linkedAt: Date.now() };
  if (account.channel && !record?.channel) channelFields.channel = account.channel;
  if (account.email && !record?.email) channelFields.email = account.email;
  await commit([
    { path: userPath(identity.uid), fields, precondition: "exists" },
    { path: channelPath(account.channelId), fields: channelFields },
  ]);
  if (record?.uid && record.uid !== identity.uid) {
    // The channel moved to a different Firebase account: the old profile loses its verified status.
    await commit([
      {
        path: userPath(record.uid),
        fields: { verifiedChannelId: null, plus: false, plusUntil: null, plusSyncedAt: Date.now() },
        precondition: "exists",
      },
    ]).catch(() => {});
  }
  return { channelId: account.channelId, subscriberCount, plus: status };
}
