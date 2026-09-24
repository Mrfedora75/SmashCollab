/** Client logout helpers — wipe matchcut/YouTube state; leave Grok broker alone. */
import { PLUS_LOCAL_KEY } from "@/lib/youtube/plus-client";

const TERMS_KEY = "matchcut-terms";
const PROFILE_KEY = "matchcut-profile";
export const SESSION_KEY = "matchcut-signed-in";
const AGE_KEY = "matchcut-age";
const DECK_KEY = "matchcut-v1";

const LOGOUT_LOCAL_KEYS = [TERMS_KEY, PROFILE_KEY, SESSION_KEY, DECK_KEY] as const;

/**
 * Wipe every matchcut / YouTube client artifact so the next visitor must sign in
 * from scratch. Keeps `matchcut-age` so the 18+ gate does not re-prompt.
 * Leaves Grok broker auth (`grok-auth.*` / better-auth) alone.
 */
export function clearSessionStorageOnly() {
  for (const key of LOGOUT_LOCAL_KEYS) {
    localStorage.removeItem(key);
  }

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key || key === AGE_KEY || key === PLUS_LOCAL_KEY) continue;
    if (
      key.startsWith("matchcut-") ||
      key.startsWith("youtube-") ||
      key.startsWith("yt_")
    ) {
      localStorage.removeItem(key);
    }
  }

  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    if (key.startsWith("grok-auth") || key.startsWith("better-auth")) continue;
    if (
      key.startsWith("matchcut-") ||
      key.startsWith("youtube-") ||
      key.startsWith("yt_") ||
      key.includes("matchcut") ||
      key.includes("youtube")
    ) {
      sessionStorage.removeItem(key);
    }
  }
}

/** @deprecated Prefer logoutAndReset; kept as storage wipe used before reload. */
export function clearSession() {
  clearSessionStorageOnly();
}

/**
 * End the YouTube session and lock the desk.
 * Profile, messages, blocked creators, pitches, and Plus time stay on this device.
 */
export async function logoutAndReset(): Promise<void> {
  try {
    await fetch("/api/youtube/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch {
    // Best-effort: still lock the desk if the network call fails.
  }
  localStorage.setItem(SESSION_KEY, "0");
  window.location.assign("/");
}
