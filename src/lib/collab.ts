/**
 * Real collab data in Firestore (client SDK, guarded by firestore.rules).
 *
 *   users/{uid}                      public creator profile (owner writes; some fields server-only)
 *   swipes/{fromUid}_{toUid}         Pass (owner writes) / Pitch (server writes via POST /api/pitch)
 *   matches/{uidA}_{uidB}            created by the server when both pitched each other
 *   matches/{id}/messages/{msgId}    readable/writable by the two participants only
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { todayKey } from "@/lib/format";
import { PITCH_MESSAGES, type PitchRefusal } from "@/lib/pitch-policy";

export type Direction = "pass" | "pitch";

export type RemoteSwipe = {
  to: string;
  direction: Direction;
  note: string;
  at: number;
  day: string;
};

export type InboundRemote = { from: string; note: string; at: number };

export type RemoteMatch = {
  id: string;
  other: string;
  createdAt: number;
  blockedBy: string | null;
};

export type RemoteMessage = { id: string; from: string; text: string; at: number };

export const MESSAGE_MAX = 2000;
export const NOTE_MAX = 1000;

function millis(value: unknown): number {
  const ts = value as Timestamp | null | undefined;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  return Date.now();
}

export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

async function ctx(): Promise<{ db: NonNullable<Awaited<ReturnType<typeof firebaseDb>>>; uid: string }> {
  const [db, auth] = await Promise.all([firebaseDb(), firebaseAuth()]);
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) throw new Error("Sign in again to sync your desk.");
  return { db, uid };
}

export async function loadMySwipes(): Promise<RemoteSwipe[]> {
  const { db, uid } = await ctx();
  const snap = await getDocs(query(collection(db, "swipes"), where("from", "==", uid)));
  return snap.docs.flatMap((item) => {
    const data = item.data();
    if (typeof data.to !== "string" || (data.direction !== "pass" && data.direction !== "pitch")) return [];
    const at = millis(data.createdAt);
    return [{ to: data.to, direction: data.direction, note: typeof data.note === "string" ? data.note : "", at, day: todayKey(new Date(at)) }];
  });
}

export type PitchErrorCode = PitchRefusal | "auth" | "invalid" | "no_profile" | "not_found" | "unavailable";

export class PitchError extends Error {
  constructor(
    message: string,
    readonly code: PitchErrorCode,
  ) {
    super(message);
    this.name = "PitchError";
  }
}

export type PitchOutcome = {
  matched: boolean;
  usedCredit: boolean;
  pitchCredits: number;
  freeUsedToday: number;
  day: string;
};

async function idToken(): Promise<string> {
  const auth = await firebaseAuth();
  const user = auth?.currentUser;
  if (!user) throw new PitchError("Sign in again to sync your desk.", "auth");
  return user.getIdToken();
}

/**
 * Send a pitch through the server, which checks the free-pitch limits, spends a
 * $1 pitch credit if needed, and creates the match if they already pitched you.
 */
export async function sendPitch(to: string, note: string): Promise<PitchOutcome> {
  const token = await idToken();
  let res: Response;
  try {
    res = await fetch("/api/pitch", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, note: note.slice(0, NOTE_MAX) }),
    });
  } catch {
    throw new PitchError("Could not reach the server. Check your connection and try again.", "unavailable");
  }
  const data = (await res.json().catch(() => ({}))) as Partial<PitchOutcome> & { error?: string; code?: PitchErrorCode };
  if (!res.ok) {
    const code = data.code ?? "unavailable";
    const known = code === "over_limit" || code === "target_unverified" || code === "daily_limit";
    throw new PitchError(known ? PITCH_MESSAGES[code] : (data.error ?? "Could not send that pitch."), code);
  }
  return {
    matched: data.matched === true,
    usedCredit: data.usedCredit === true,
    pitchCredits: typeof data.pitchCredits === "number" ? data.pitchCredits : 0,
    freeUsedToday: typeof data.freeUsedToday === "number" ? data.freeUsedToday : 0,
    day: typeof data.day === "string" ? data.day : "",
  };
}

export type ProfileSync = { linked: boolean; subscriberCount: number | null; plus: boolean; day: string; freeUsedToday: number };

/** Ask the server to write the verified subscriber count and Plus status onto my profile. */
export async function syncProfileOnServer(): Promise<ProfileSync | null> {
  try {
    const token = await idToken();
    const res = await fetch("/api/profile/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ProfileSync>;
    return {
      linked: data.linked === true,
      subscriberCount: typeof data.subscriberCount === "number" ? data.subscriberCount : null,
      plus: data.plus === true,
      day: typeof data.day === "string" ? data.day : "",
      freeUsedToday: typeof data.freeUsedToday === "number" ? data.freeUsedToday : 0,
    };
  } catch {
    return null;
  }
}

/** Record a Pass (browser write). Pitches go through sendPitch. */
export async function recordPass(to: string): Promise<void> {
  const { db, uid } = await ctx();
  if (to === uid) throw new Error("You can't swipe on yourself.");
  await setDoc(doc(db, "swipes", `${uid}_${to}`), {
    from: uid,
    to,
    direction: "pass",
    note: "",
    createdAt: serverTimestamp(),
  });
}

export async function deleteSwipe(to: string): Promise<void> {
  const { db, uid } = await ctx();
  await deleteDoc(doc(db, "swipes", `${uid}_${to}`));
}

export async function deleteSwipes(targets: string[]): Promise<void> {
  if (targets.length === 0) return;
  const { db, uid } = await ctx();
  for (let i = 0; i < targets.length; i += 400) {
    const batch = writeBatch(db);
    for (const to of targets.slice(i, i + 400)) batch.delete(doc(db, "swipes", `${uid}_${to}`));
    await batch.commit();
  }
}

export async function updateSwipeNote(to: string, note: string): Promise<void> {
  const { db, uid } = await ctx();
  await updateDoc(doc(db, "swipes", `${uid}_${to}`), { note: note.slice(0, NOTE_MAX) });
}

export function watchInbound(db: NonNullable<Awaited<ReturnType<typeof firebaseDb>>>, uid: string, onData: (items: InboundRemote[]) => void, onError: (error: unknown) => void): Unsubscribe {
  const q = query(collection(db, "swipes"), where("to", "==", uid), where("direction", "==", "pitch"));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .flatMap((item) => {
            const data = item.data();
            return typeof data.from === "string"
              ? [{ from: data.from, note: typeof data.note === "string" ? data.note : "", at: millis(data.createdAt) }]
              : [];
          })
          .sort((a, b) => b.at - a.at),
      );
    },
    onError,
  );
}

export function watchMatches(db: NonNullable<Awaited<ReturnType<typeof firebaseDb>>>, uid: string, onData: (items: RemoteMatch[]) => void, onError: (error: unknown) => void): Unsubscribe {
  const q = query(collection(db, "matches"), where("users", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .flatMap((item) => {
            const data = item.data();
            const users = Array.isArray(data.users) ? (data.users as unknown[]).filter((u): u is string => typeof u === "string") : [];
            const other = users.find((u) => u !== uid);
            if (!other) return [];
            return [{
              id: item.id,
              other,
              createdAt: millis(data.createdAt),
              blockedBy: typeof data.blockedBy === "string" ? data.blockedBy : null,
            }];
          })
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    },
    onError,
  );
}

export async function watchMessages(matchId: string, onData: (items: RemoteMessage[]) => void, onError: (error: unknown) => void): Promise<Unsubscribe> {
  const { db } = await ctx();
  return onSnapshot(
    collection(db, "matches", matchId, "messages"),
    (snap) => {
      onData(
        snap.docs
          .flatMap((item) => {
            const data = item.data();
            return typeof data.from === "string" && typeof data.text === "string"
              ? [{ id: item.id, from: data.from, text: data.text, at: millis(data.createdAt) }]
              : [];
          })
          .sort((a, b) => a.at - b.at),
      );
    },
    onError,
  );
}

export async function sendMessage(matchId: string, text: string): Promise<void> {
  const { db, uid } = await ctx();
  const clean = text.trim().slice(0, MESSAGE_MAX);
  if (!clean) return;
  await addDoc(collection(db, "matches", matchId, "messages"), { from: uid, text: clean, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "matches", matchId), { lastMessageAt: serverTimestamp() }).catch(() => {});
}

export async function setMatchBlocked(matchId: string, blocked: boolean): Promise<void> {
  const { db, uid } = await ctx();
  await updateDoc(doc(db, "matches", matchId), { blockedBy: blocked ? uid : null });
}
