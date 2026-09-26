/**
 * Server-side pitch creation (POST /api/pitch).
 *
 * Browsers can no longer create pitches or matches directly (firestore.rules
 * denies it). This handler authenticates the Firebase ID token, reads the
 * target's server-written subscriber count, the sender's Plus entitlement and
 * purchased pitch credits, and the sender's daily free-pitch counter, and only
 * then writes the pitch (and the match, if the other creator already pitched)
 * in one Firestore transaction with the service account.
 */
import { decidePitch, PITCH_MESSAGES, utcDayKey, type PitchRefusal } from "@/lib/pitch-policy";
import { requestFirebaseUser } from "@/lib/server/firebase-auth.server";
import {
  getDocument,
  isStorageConfigured,
  runTransaction,
  safeDocId,
  type Plain,
  type Write,
} from "@/lib/server/firestore.server";
import { bindProfileToChannel, readChannelRecord, userPath } from "@/lib/server/public-profile.server";
import { requestAccount, resolveStoredPlus, type YtAccount } from "@/lib/youtube/plus-entitlement";

export const NOTE_MAX = 1000;

class PitchRefused extends Error {
  constructor(readonly code: PitchRefusal) {
    super(PITCH_MESSAGES[code]);
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function num(value: Plain | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function validUid(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !/[/]/.test(value) && value !== "." && value !== "..";
}

export type PitchResult = {
  ok: true;
  already: boolean;
  matched: boolean;
  usedCredit: boolean;
  pitchCredits: number;
  freeUsedToday: number;
  day: string;
};

async function senderChannel(request: Request, uid: string, email: string | null, profile: Record<string, Plain>): Promise<YtAccount | null> {
  const bound = typeof profile.verifiedChannelId === "string" && profile.verifiedChannelId ? profile.verifiedChannelId : null;
  if (bound) {
    const record = await readChannelRecord(bound);
    return { channelId: bound, channel: record?.channel ?? null, email: record?.email ?? null };
  }
  // Profiles created before server binding existed: link now from the signed YouTube session cookie.
  const account = await requestAccount(request);
  if (!account) return null;
  try {
    await bindProfileToChannel({ uid, email, emailVerified: true }, account);
    return account;
  } catch {
    return null;
  }
}

export async function handlePitchRequest(request: Request): Promise<Response> {
  const identity = await requestFirebaseUser(request);
  if (!identity) return json({ error: "Sign in again to pitch.", code: "auth" }, 401);

  let body: { to?: unknown; note?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const to = body.to;
  const note = typeof body.note === "string" ? body.note.slice(0, NOTE_MAX) : "";
  if (!validUid(to)) return json({ error: "Pick a creator to pitch.", code: "invalid" }, 400);
  if (body.note != null && typeof body.note !== "string") return json({ error: "Invalid note.", code: "invalid" }, 400);
  const uid = identity.uid;
  if (to === uid) return json({ error: "You can't pitch yourself.", code: "invalid" }, 400);
  if (!isStorageConfigured()) return json({ error: "Pitching is unavailable right now.", code: "unavailable" }, 503);

  try {
    const [senderProfile, targetProfile] = await Promise.all([getDocument(userPath(uid)), getDocument(userPath(to))]);
    if (!senderProfile) return json({ error: "Create your profile before pitching.", code: "no_profile" }, 409);
    if (!targetProfile) return json({ error: "That creator isn't on Smash Collab anymore.", code: "not_found" }, 404);

    const account = await senderChannel(request, uid, identity.email, senderProfile);
    const plus = account ? (await resolveStoredPlus(account)).premium : false;
    const targetSubs =
      typeof targetProfile.subscriberCount === "number" && Number.isFinite(targetProfile.subscriberCount)
        ? targetProfile.subscriberCount
        : null;

    const day = utcDayKey();
    const swipePath = `swipes/${safeDocId(`${uid}_${to}`)}`;
    const reversePath = `swipes/${safeDocId(`${to}_${uid}`)}`;
    const users = [uid, to].sort();
    const matchPath = `matches/${safeDocId(`${users[0]}_${users[1]}`)}`;
    const usagePath = `pitchUsage/${safeDocId(uid)}`;
    const entitlementPath = account ? `entitlements/${safeDocId(account.channelId)}` : null;

    const result = await runTransaction<PitchResult>(async (tx) => {
      const [existing, usage, entitlement, reverse, match] = await Promise.all([
        tx.get(swipePath),
        tx.get(usagePath),
        entitlementPath ? tx.get(entitlementPath) : Promise.resolve(null),
        tx.get(reversePath),
        tx.get(matchPath),
      ]);
      const freeUsedToday = usage?.day === day ? Math.max(0, Math.floor(num(usage?.count))) : 0;
      const credits = Math.max(0, Math.floor(num(entitlement?.pitchCredits)));
      const matched = reverse?.direction === "pitch";
      const matchWrite: Write = {
        path: matchPath,
        fields: { users, blockedBy: null, lastMessageAt: null },
        serverTime: ["createdAt"],
        precondition: "absent",
      };
      if (existing?.direction === "pitch") {
        // Already pitched: nothing is charged again (repair a missing match if both pitched).
        return {
          writes: matched && !match ? [matchWrite] : [],
          result: { ok: true, already: true, matched, usedCredit: false, pitchCredits: credits, freeUsedToday, day },
        };
      }
      const decision = decidePitch({ plus, targetSubscribers: targetSubs, freeUsedToday, credits });
      if (!decision.allowed) throw new PitchRefused(decision.code);

      const writes: Write[] = [
        {
          path: swipePath,
          fields: { from: uid, to, direction: "pitch", note },
          serverTime: ["createdAt"],
        },
      ];
      const nextFree = decision.countsAsFree ? freeUsedToday + 1 : freeUsedToday;
      writes.push({ path: usagePath, fields: { uid, day, count: nextFree, updatedAt: Date.now() } });
      if (decision.useCredit && entitlementPath && account) {
        writes.push({
          path: entitlementPath,
          fields: { channelId: account.channelId, updatedAt: Date.now() },
          increment: { pitchCredits: -1 },
        });
      }
      if (matched && !match) writes.push(matchWrite);
      return {
        writes,
        result: {
          ok: true,
          already: false,
          matched,
          usedCredit: decision.useCredit,
          pitchCredits: decision.useCredit ? credits - 1 : credits,
          freeUsedToday: nextFree,
          day,
        },
      };
    });
    return json(result);
  } catch (error) {
    if (error instanceof PitchRefused) {
      return json({ error: error.message, code: error.code }, error.code === "daily_limit" ? 429 : 403);
    }
    return json({ error: "Could not send that pitch right now. Try again.", code: "unavailable" }, 503);
  }
}
