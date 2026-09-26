/**
 * Real collab data in Firestore (client SDK, guarded by firestore.rules).
 *
 *   users/{uid}                      public creator profile (owner writes)
 *   swipes/{fromUid}_{toUid}         Pass / Pitch (owner writes; target can read pitches)
 *   matches/{uidA}_{uidB}            created only when both pitched each other
 *   matches/{id}/messages/{msgId}    readable/writable by the two participants only
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

/** Record a Pass/Pitch. A pitch back to someone who already pitched you creates the match. */
export async function recordSwipe(to: string, direction: Direction, note: string): Promise<{ matched: boolean }> {
  const { db, uid } = await ctx();
  if (to === uid) throw new Error("You can't swipe on yourself.");
  await setDoc(doc(db, "swipes", `${uid}_${to}`), {
    from: uid,
    to,
    direction,
    note: note.slice(0, NOTE_MAX),
    createdAt: serverTimestamp(),
  });
  if (direction !== "pitch") return { matched: false };
  return { matched: await tryCreateMatch(uid, to) };
}

async function tryCreateMatch(uid: string, other: string): Promise<boolean> {
  const db = await firebaseDb();
  if (!db) return false;
  try {
    // Readable only if it exists and is a pitch aimed at us (see firestore.rules).
    const theirs = await getDoc(doc(db, "swipes", `${other}_${uid}`));
    if (!theirs.exists() || theirs.data().direction !== "pitch") return false;
  } catch {
    return false;
  }
  const id = pairId(uid, other);
  const ref = doc(db, "matches", id);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return true;
    await setDoc(ref, {
      users: [uid, other].sort(),
      createdAt: serverTimestamp(),
      blockedBy: null,
      lastMessageAt: null,
    });
    return true;
  } catch {
    return false;
  }
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
