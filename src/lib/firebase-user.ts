import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithCustomToken, type User } from "firebase/auth";
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { normalizeFilterNiche } from "@/data/creators";
import type { DeskProfile } from "@/components/matchcut/onboarding-storage";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { syncProfileOnServer } from "@/lib/collab";
import { fillFromSaved, profileFromDoc } from "@/lib/profile-merge";

export function describeAuthError(error: unknown): string {
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";
    if (code && message) return message.includes(code) ? message : `${code}: ${message}`;
    if (message) return message;
  }
  return error instanceof Error ? error.message : "Sign-in failed.";
}

async function restoredUser(): Promise<User | null> {
  const auth = await firebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

/** No Firebase session could be restored: the creator has to verify via YouTube again. */
export class NeedsVerifyError extends Error {
  constructor(message = "Verify via YouTube to sign in on this device.") {
    super(message);
    this.name = "NeedsVerifyError";
  }
}

export function isNeedsVerify(error: unknown): error is NeedsVerifyError {
  return error instanceof NeedsVerifyError;
}

/** Send the browser through YouTube verification (sets fresh sign-in cookies, returns with ?yt=ok). */
export function startYouTubeVerify(): void {
  window.location.assign("/api/youtube/start");
}

/** One-shot Google ID token left by the OAuth callback (valid ~10 minutes, cleared when read). */
async function takeGoogleIdToken(): Promise<string | null> {
  const res = await fetch("/api/firebase/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { idToken?: string | null };
  return typeof data.idToken === "string" && data.idToken ? data.idToken : null;
}

/** Firebase custom token minted from the long-lived verified-channel cookie. */
async function fetchCustomToken(): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/firebase/custom-token", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Could not reach the server to restore your sign-in. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string; needsVerify?: boolean };
  if (res.ok && typeof data.token === "string" && data.token) return data.token;
  if (data.needsVerify) throw new NeedsVerifyError(data.error || undefined);
  throw new Error(data.error || `Could not restore your sign-in (${res.status}).`);
}

let inFlight: Promise<User> | null = null;

/**
 * Make sure this browser has a Firebase user, without opening a Google popup:
 *   1. an existing (persisted) Firebase session;
 *   2. the one-shot Google ID token from a YouTube verification in the last few minutes;
 *   3. a custom token from /api/firebase/custom-token (long-lived verified-channel cookie).
 * Throws NeedsVerifyError when the creator must verify via YouTube again, or an
 * Error describing what failed. Never resolves without a user.
 */
export function signInToFirebase(): Promise<User> {
  if (!inFlight) {
    inFlight = doSignIn().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doSignIn(): Promise<User> {
  const existing = await restoredUser();
  if (existing) return existing;
  const auth = await firebaseAuth();
  if (!auth) throw new Error("Firebase is not configured.");

  let googleError: unknown = null;
  let idToken: string | null = null;
  try {
    idToken = await takeGoogleIdToken();
  } catch {
    idToken = null;
  }
  if (idToken) {
    try {
      const signedIn = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return signedIn.user;
    } catch (error) {
      googleError = error;
    }
  }

  try {
    const token = await fetchCustomToken();
    const signedIn = await signInWithCustomToken(auth, token);
    return signedIn.user;
  } catch (error) {
    // If Google itself rejected a fresh verification, re-verifying would loop: show that error instead.
    if (googleError && isNeedsVerify(error)) {
      throw new Error(`Google sign-in was rejected: ${describeAuthError(googleError)}`);
    }
    throw error;
  }
}

/** The signed-in user, restoring the session if needed (throws like signInToFirebase). */
async function requireUser(): Promise<User> {
  return (await restoredUser()) ?? (await signInToFirebase());
}

/**
 * Save the creator's profile to Firestore and return what was saved.
 *
 * mode "edit" (profile dashboard) writes exactly what the creator typed.
 * mode "onboarding" (sign-in / re-verify) fills anything empty on this device
 * from the saved Firestore profile first, so it never blanks a saved bio,
 * country, state, county, niches, name, or photo.
 */
export async function saveFirebaseUser(
  profile: DeskProfile,
  options: { mode?: "edit" | "onboarding" } = {},
): Promise<DeskProfile> {
  const db = await firebaseDb();
  if (!db) throw new Error("Firebase is not configured.");
  let user: User;
  try {
    user = await requireUser();
  } catch (error) {
    if (isNeedsVerify(error)) throw new NeedsVerifyError("Verify via YouTube to save your profile to your account.");
    throw error;
  }
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  const merged =
    options.mode === "onboarding" && existing.exists()
      ? fillFromSaved(profile, existing.data() as Record<string, unknown>)
      : profile;
  const niches = merged.niches.flatMap((item) => {
    const next = normalizeFilterNiche(item);
    return next ? [next] : [];
  }).filter((item, index, all) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
  await setDoc(
    ref,
    {
      uid: user.uid,
      // Profiles are readable by other signed-in creators, so no email here.
      email: deleteField(),
      displayName: merged.displayName || user.displayName || "",
      channel: merged.channel,
      channelId: merged.channelId ?? null,
      // Subscriber count is written by the server from the YouTube Data API (see /api/profile/sync).
      avgViews: merged.avgViews,
      niches,
      bio: (merged.bio ?? "").slice(0, 150),
      avatar: merged.avatar ?? user.photoURL ?? null,
      country: merged.country ?? "",
      state: merged.country === "us" ? (merged.state ?? null) : null,
      county: merged.county?.trim().slice(0, 40) ?? "",
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
  await syncProfileOnServer();
  return { ...merged, niches };
}

/** The signed-in creator's saved Firestore profile (used to restore after logout / on a new device). */
export async function loadFirebaseProfile(): Promise<DeskProfile | null> {
  const db = await firebaseDb();
  const user = await restoredUser();
  if (!db || !user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  return profileFromDoc(snap.data() as Record<string, unknown>);
}

export async function currentFirebaseUid(): Promise<string | null> {
  const user = await restoredUser();
  return user?.uid ?? null;
}
