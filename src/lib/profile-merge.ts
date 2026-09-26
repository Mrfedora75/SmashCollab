/**
 * Pure helpers for reconciling a creator profile held in this browser with the
 * copy saved in Firestore (`users/{uid}`). No Firebase imports, so it is unit-testable.
 */
import { PROFILE_COUNTRIES, US_STATES, type ProfileCountry, type UsState } from "@/data/creators";
import type { DeskProfile } from "@/components/matchcut/onboarding-storage";

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isCountry(value: unknown): value is ProfileCountry {
  return typeof value === "string" && PROFILE_COUNTRIES.some((item) => item.id === value);
}

function isUsState(value: unknown): value is UsState {
  return typeof value === "string" && (US_STATES as readonly string[]).includes(value);
}

/** A DeskProfile from a Firestore `users/{uid}` document, or null if it is not a finished profile. */
export function profileFromDoc(data: Record<string, unknown> | null | undefined): DeskProfile | null {
  if (!data) return null;
  const niches = Array.isArray(data.niches) ? data.niches.filter((n): n is string => typeof n === "string" && n.trim().length > 0) : [];
  if (typeof data.channel !== "string" || !data.channel || niches.length === 0) return null;
  const country = isCountry(data.country) ? data.country : "";
  return {
    displayName: str(data.displayName) || data.channel,
    channel: data.channel,
    channelId: str(data.channelId) || undefined,
    subscribers:
      typeof data.subscriberCount === "number"
        ? data.subscriberCount
        : typeof data.subscribers === "number"
          ? data.subscribers
          : 0,
    avgViews: typeof data.avgViews === "number" ? data.avgViews : 0,
    niches,
    bio: str(data.bio).slice(0, 150),
    avatar: str(data.avatar) || null,
    country,
    state: country === "us" && isUsState(data.state) ? data.state : null,
    county: str(data.county).slice(0, 40),
  };
}

/**
 * Onboarding / re-verify saves: anything the creator has not filled in on this
 * device is taken from the saved Firestore profile, so a fresh device (or a
 * cleared browser) never writes an empty bio, country, state, county, niches,
 * display name, or photo over what is already saved. Deliberate edits go
 * through the profile dashboard, which saves exactly what was typed.
 */
export function fillFromSaved(local: DeskProfile, saved: Record<string, unknown> | null | undefined): DeskProfile {
  if (!saved) return local;
  const next: DeskProfile = { ...local };
  if (!next.bio?.trim() && str(saved.bio).trim()) next.bio = str(saved.bio).slice(0, 150);
  if (!next.displayName?.trim() && str(saved.displayName).trim()) next.displayName = str(saved.displayName);
  if (!next.avatar && str(saved.avatar)) next.avatar = str(saved.avatar);
  if (next.niches.length === 0 && Array.isArray(saved.niches)) {
    next.niches = saved.niches.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  }
  if (!next.country && isCountry(saved.country)) {
    next.country = saved.country;
    next.state = saved.country === "us" && isUsState(saved.state) ? saved.state : null;
    next.county = str(saved.county).slice(0, 40);
  } else if (next.country && next.country === saved.country) {
    if (!next.state && next.country === "us" && isUsState(saved.state)) next.state = saved.state;
    if (!next.county?.trim() && str(saved.county).trim()) next.county = str(saved.county).slice(0, 40);
  }
  return next;
}
