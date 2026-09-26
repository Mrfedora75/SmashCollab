import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { normalizeFilterNiche } from "@/data/creators";
import type { DeskProfile } from "@/components/matchcut/onboarding-storage";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { syncProfileOnServer } from "@/lib/collab";
import { fillFromSaved, profileFromDoc } from "@/lib/profile-merge";
import { isStorableAvatar } from "@/lib/avatar";
import { clearServerSession } from "@/lib/youtube/client-logout";

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
  options: {
    mode?: "edit" | "onboarding";
    /** Called when the photo could not be saved; everything else was saved. */
    onPhotoNotSaved?: (message: string) => void;
  } = {},
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
  const savedData = existing.exists() ? (existing.data() as Record<string, unknown>) : null;
  const merged =
    options.mode === "onboarding" && savedData
      ? fillFromSaved(profile, savedData)
      : profile;
  const niches = merged.niches.flatMap((item) => {
    const next = normalizeFilterNiche(item);
    return next ? [next] : [];
  }).filter((item, index, all) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
  const savedAvatar = typeof savedData?.avatar === "string" ? savedData.avatar : null;
  const avatar = merged.avatar ?? user.photoURL ?? null;
  const fields: Record<string, unknown> = {
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
    avatar,
    country: merged.country ?? "",
    state: merged.country === "us" ? (merged.state ?? null) : null,
    county: merged.county?.trim().slice(0, 40) ?? "",
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  };
  // A photo must never sink the name / bio save: leave the saved photo as it is when the
  // new one is not storable, or when the rules refuse it.
  let photoError: string | null = null;
  const withoutPhoto = () => {
    const rest = { ...fields };
    delete rest.avatar;
    return rest;
  };
  const photoChanged = avatar !== savedAvatar;
  if (photoChanged && !isStorableAvatar(avatar)) {
    photoError = "That photo is too large or not a supported image. Try a different photo.";
    await setDoc(ref, withoutPhoto(), { merge: true });
  } else {
    try {
      await setDoc(ref, fields, { merge: true });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!photoChanged || code !== "permission-denied") throw error;
      await setDoc(ref, withoutPhoto(), { merge: true });
      photoError = "Your account did not accept that photo. Try a different photo.";
    }
  }
  await syncProfileOnServer();
  if (photoError) {
    options.onPhotoNotSaved?.(photoError);
    return { ...merged, niches, avatar: savedAvatar };
  }
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

export type ContinueResult =
  | { status: "restored"; profile: DeskProfile; channelId: string; premium: boolean; premiumUntil: number | null }
  | { status: "needsVerify" }
  | { status: "cancelled" };

function authCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}

/**
 * "Continue as @channel": a plain Google sign-in (Firebase popup), then the
 * server restores the YouTube-verified session from its own records
 * (POST /api/auth/restore). No YouTube re-verify when the account already has
 * a verified channel; { status: "needsVerify" } when it does not.
 *
 * Pass an Auth that is already initialised (see firebaseAuth) so the popup
 * opens straight from the tap and is not blocked.
 *
 * `loginHint` (the remembered account email) makes Google go straight to that
 * account instead of the "Choose an account" picker. It is only a UX hint: the
 * server checks the signed-in uid and verified email against its own records.
 */
export function googleProviderFor(loginHint: string | null | undefined): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters(loginHint ? { login_hint: loginHint } : { prompt: "select_account" });
  return provider;
}

export async function continueWithGoogle(auth: Auth, loginHint?: string | null): Promise<ContinueResult> {
  const provider = googleProviderFor(loginHint);
  let user: User;
  try {
    user = (await signInWithPopup(auth, provider)).user;
  } catch (error) {
    const code = authCode(error);
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return { status: "cancelled" };
    if (code === "auth/popup-blocked") throw new Error("Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.");
    throw error;
  }
  // Once the server has re-issued session cookies, a bail-out must expire them again.
  let serverSession = false;
  const bail = async () => {
    await signOut(auth).catch(() => {});
    if (serverSession) {
      serverSession = false;
      await clearServerSession();
    }
  };
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/auth/restore", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      restored?: boolean;
      channelId?: string;
      premium?: boolean;
      premiumUntil?: number | null;
      error?: string;
      needsVerify?: boolean;
    };
    if (!res.ok || data.restored !== true || typeof data.channelId !== "string") {
      await bail();
      if (data.needsVerify) return { status: "needsVerify" };
      throw new Error(data.error || `Could not sign you in (${res.status}).`);
    }
    serverSession = true;
    const profile = await loadFirebaseProfile();
    // An unfinished profile (or one saved for another channel) goes through the normal flow.
    if (!profile || (profile.channelId && profile.channelId !== data.channelId)) {
      await bail();
      return { status: "needsVerify" };
    }
    return {
      status: "restored",
      profile: { ...profile, channelId: data.channelId },
      channelId: data.channelId,
      premium: data.premium === true,
      premiumUntil: typeof data.premiumUntil === "number" ? data.premiumUntil : null,
    };
  } catch (error) {
    await bail();
    throw error;
  }
}
