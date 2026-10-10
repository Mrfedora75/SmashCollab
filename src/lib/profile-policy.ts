/**
 * Who may have a public profile, and which profile fields other creators may see.
 * Shared by the server (enforcement) and the browser (prompts only).
 */

/**
 * Minimum age to use Smash Collab. The app has always required 18+ (age gate,
 * Terms, Privacy Policy); change it here and in those pages together.
 */
export const MIN_AGE = 18;
export const AGE_CONFIRM_LABEL = `I am ${MIN_AGE} or older`;
export const AGE_REQUIRED_MESSAGE = `Confirm you are ${MIN_AGE} or older to create your profile.`;

/** Max creators per /api/members page, and the most the desk loads in one session. */
export const MEMBERS_PAGE_SIZE = 50;
export const MEMBERS_MAX_PER_SESSION = 500;

/** The only profile fields ever returned to other creators. */
export const PUBLIC_PROFILE_FIELDS = [
  "displayName",
  "channel",
  "channelId",
  "subscriberCount",
  "avgViews",
  "niches",
  "bio",
  "avatar",
  "country",
  "state",
  "county",
  "plus",
  "plusUntil",
] as const;

type Doc = Record<string, unknown>;

export function hasConfirmedAge(doc: Doc | null | undefined): boolean {
  return doc?.ageConfirmed === true;
}

export function hasVerifiedChannel(doc: Doc | null | undefined): boolean {
  return typeof doc?.verifiedChannelId === "string" && doc.verifiedChannelId.length > 0;
}

/** A profile is shown to other creators only with a server-verified YouTube channel AND the age confirmation. */
export function isPublicProfile(doc: Doc | null | undefined): boolean {
  return hasConfirmedAge(doc) && hasVerifiedChannel(doc) && typeof doc?.channel === "string" && doc.channel.trim() !== "";
}

export function publicProfileView(doc: Doc): Doc {
  const out: Doc = {};
  for (const key of PUBLIC_PROFILE_FIELDS) if (key in doc) out[key] = doc[key];
  return out;
}
