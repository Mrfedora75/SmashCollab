/**
 * "Continue as @channel" hint: the ONLY thing kept on this device after logout.
 *
 * It is display-only and non-sensitive (channel handle, name, a public https
 * photo URL, Firebase uid). It never contains tokens, emails, chats, or drafts,
 * and it grants nothing: tapping Continue still requires a real Google sign-in,
 * and the server decides from its own records whether the channel is verified.
 */
export const LOGIN_HINT_KEY = "smash-login-hint";

export type LoginHint = {
  channel: string;
  displayName: string;
  avatar: string | null;
  uid: string | null;
};

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Only a short public https photo URL (never an uploaded data: photo). */
function safeAvatar(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** Normalise untrusted input into a hint, or null if there is nothing useful to show. */
export function toLoginHint(input: {
  channel?: unknown;
  displayName?: unknown;
  avatar?: unknown;
  uid?: unknown;
} | null | undefined): LoginHint | null {
  if (!input) return null;
  const channel = clip(input.channel, 100);
  if (!channel) return null;
  const uid = clip(input.uid, 128);
  return {
    channel,
    displayName: clip(input.displayName, 100) || channel,
    avatar: safeAvatar(input.avatar),
    uid: uid || null,
  };
}

export function saveLoginHint(hint: LoginHint | null, storage: KV = localStorage): void {
  const clean = toLoginHint(hint);
  if (!clean) {
    storage.removeItem(LOGIN_HINT_KEY);
    return;
  }
  storage.setItem(LOGIN_HINT_KEY, JSON.stringify(clean));
}

export function loadLoginHint(storage: KV = localStorage): LoginHint | null {
  try {
    const raw = storage.getItem(LOGIN_HINT_KEY);
    return raw ? toLoginHint(JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function clearLoginHint(storage: KV = localStorage): void {
  storage.removeItem(LOGIN_HINT_KEY);
}
