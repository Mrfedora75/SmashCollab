import { NICHES, PROFILE_COUNTRIES, US_STATES, type Niche, type ProfileCountry, type UsState } from "@/data/creators";

const TERMS_KEY = "matchcut-terms";
const PROFILE_KEY = "matchcut-profile";
export const SESSION_KEY = "matchcut-signed-in";

export type DeskProfile = {
  displayName: string;
  channel: string;
  channelId?: string;
  subscribers: number;
  avgViews: number;
  niches: Niche[];
  bio: string;
  avatar: string | null;
  country?: ProfileCountry | "";
  state?: UsState | null;
  county?: string;
};

export type VerifiedChannel = {
  displayName: string;
  channel: string;
  channelId: string;
  subscribers: number;
  avgViews: number;
  avatar: string | null;
  premium?: boolean;
  premiumUntil?: number | null;
};

function isCountry(value: unknown): value is ProfileCountry {
  return typeof value === "string" && PROFILE_COUNTRIES.some((item) => item.id === value);
}

function isUsState(value: unknown): value is UsState {
  return typeof value === "string" && (US_STATES as readonly string[]).includes(value);
}

function isNiche(value: unknown): value is Niche {
  return typeof value === "string" && (NICHES as readonly string[]).includes(value);
}

function isAvatarUrl(value: string): boolean {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  );
}

export function loadTerms(): boolean {
  return localStorage.getItem(TERMS_KEY) === "accepted";
}

export function saveProfile(profile: DeskProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(SESSION_KEY, "1");
}

export function loadProfile(): DeskProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeskProfile>;
    const niches = Array.isArray(parsed.niches) ? parsed.niches.filter(isNiche) : [];
    if (typeof parsed.channel !== "string" || typeof parsed.subscribers !== "number" || niches.length === 0) {
      return null;
    }
    const avatar =
      typeof parsed.avatar === "string" && isAvatarUrl(parsed.avatar) ? parsed.avatar : null;
    const country = isCountry(parsed.country) ? parsed.country : "";
    const state = country === "us" && isUsState(parsed.state) ? parsed.state : null;
    const county = typeof parsed.county === "string" ? parsed.county.trim().slice(0, 40) : "";
    return {
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName
          : parsed.channel,
      channel: parsed.channel,
      channelId: typeof parsed.channelId === "string" ? parsed.channelId : undefined,
      subscribers: parsed.subscribers,
      avgViews: typeof parsed.avgViews === "number" ? parsed.avgViews : 0,
      niches,
      bio: typeof parsed.bio === "string" ? parsed.bio.slice(0, 150) : "",
      avatar,
      country,
      state,
      county,
    };
  } catch {
    return null;
  }
}

export { TERMS_KEY };
