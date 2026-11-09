/**
 * "Enable Push Notifications" choice, kept on this device.
 *
 * The key deliberately does not start with "matchcut-", "youtube-" or "yt_", so the
 * Log Out wipe (src/lib/youtube/client-logout.ts) leaves it alone and the switch is
 * still on after signing out and back in. It is a plain on/off device setting, not
 * account or sign-in data.
 */
export const PUSH_PREF_KEY = "smashcollab-push-enabled";

export function loadPushPref(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(PUSH_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePushPref(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PUSH_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // Storage full or blocked (private mode): the switch still works for this visit.
  }
}
