/** Client logout: Firebase sign-out + full local-data and cookie wipe. */
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { saveLoginHint, toLoginHint, type LoginHint } from "@/lib/login-hint";

const PROFILE_KEY = "matchcut-profile";
export const SESSION_KEY = "matchcut-signed-in";
/** The 18+ answer is the only thing kept, so the age gate does not re-prompt. */
const AGE_KEY = "matchcut-age";
const DECK_KEY = "matchcut-v1";

/**
 * Wipe every app / YouTube client artifact on this device. Profile, swipes,
 * matches, and messages are restored from Firestore on the next sign-in, and
 * Plus is restored from the server, so nothing paid-for is lost.
 */
export function clearSessionStorageOnly() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(DECK_KEY);
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key || key === AGE_KEY) continue;
    if (key.startsWith("matchcut-") || key.startsWith("youtube-") || key.startsWith("yt_")) {
      localStorage.removeItem(key);
    }
  }
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    if (key.includes("matchcut") || key.includes("youtube") || key.startsWith("yt_")) {
      sessionStorage.removeItem(key);
    }
  }
}

/** The "Continue as @channel" hint for the account that is signing out (display fields only). */
function hintForLogout(uid: string | null): LoginHint | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const profile = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    return toLoginHint(profile ? { ...profile, uid } : null);
  } catch {
    return null;
  }
}

/**
 * Log out: sign out of Firebase, expire server cookies, wipe local data, reload.
 * The only thing kept is the non-sensitive "Continue as @channel" hint.
 */
export async function logoutAndReset(): Promise<void> {
  let uid: string | null = null;
  try {
    const auth = await firebaseAuth();
    uid = auth?.currentUser?.uid ?? null;
    if (auth) await signOut(auth);
  } catch {
    // Best-effort: still clear everything else.
  }
  const hint = hintForLogout(uid);
  try {
    await fetch("/api/youtube/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch {
    // Best-effort: still wipe local state if the network call fails.
  }
  clearSessionStorageOnly();
  if (hint) saveLoginHint(hint);
  localStorage.setItem(SESSION_KEY, "0");
  window.location.assign("/");
}
