/**
 * Profile photo rules shared by the browser code. Must match firestore.rules
 * (validAvatar): an https URL (YouTube / Google photo) or a small uploaded
 * JPEG/PNG/WebP data URL of at most AVATAR_MAX_CHARS characters.
 */
export const AVATAR_MAX_CHARS = 60_000;

/** Uploads are re-encoded to stay well under the limit. */
export const AVATAR_TARGET_CHARS = 45_000;

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isUploadedAvatar(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

/** True when Firestore will accept this value in users/{uid}.avatar. */
export function isStorableAvatar(value: string | null | undefined): boolean {
  if (value == null) return true;
  if (typeof value !== "string" || value.length > AVATAR_MAX_CHARS) return false;
  return value.startsWith("https://") || DATA_URL.test(value);
}

/** True when an avatar from another member's profile may be shown in an <img>. */
export function isDisplayableAvatar(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= AVATAR_MAX_CHARS &&
    (/^https?:\/\//.test(value) || DATA_URL.test(value))
  );
}
