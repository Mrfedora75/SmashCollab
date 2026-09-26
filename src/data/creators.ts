export const NICHES = [
  "Paranormal",
  "Music",
  "80s/90s Nostalgia",
  "True Crime",
  "Tech",
  "Fitness",
  "Cooking",
  "Home",
  "Travel",
  "DIY",
  "Beauty",
  "Finance",
  "Education",
  "Gaming",
] as const;

export type Niche = (typeof NICHES)[number];

export function normalizeFilterNiche(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 40) return null;
  const preset = NICHES.find((item) => item.toLowerCase() === trimmed.toLowerCase());
  return preset ?? trimmed;
}

export const LOCATIONS = [
  { id: "global", label: "Global / Remote Collabs" },
  { id: "us", label: "United States" },
  { id: "us-state", label: "United States (Specific State)" },
  { id: "uk", label: "United Kingdom" },
  { id: "europe", label: "Europe" },
  { id: "latam", label: "Latin America" },
] as const;

export type LocationId = (typeof LOCATIONS)[number]["id"];
export type Region = "us" | "uk" | "europe" | "latam";

export const PROFILE_COUNTRIES = [
  { id: "us", label: "United States" },
  { id: "uk", label: "United Kingdom" },
  { id: "europe", label: "Europe" },
  { id: "latam", label: "Latin America" },
  { id: "other", label: "Other" },
] as const;

export type ProfileCountry = (typeof PROFILE_COUNTRIES)[number]["id"];

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

export type UsState = (typeof US_STATES)[number];

export type Creator = {
  id: string;
  name: string;
  channel: string;
  subscribers: number;
  avgViews: number;
  niches: string[];
  location: Region | "remote";
  state: UsState | null;
  county?: string | null;
  videoTitle: string;
  duration: string;
  thumb: string;
  openTo: string;
  fit: number;
  rating: number;
};

export const BRACKETS = [
  { id: "micro", label: "Under 10K Subs", range: "Under 10K", min: 0, max: 10_000 },
  { id: "rising", label: "10K – 100K Subs", range: "10K–100K", min: 10_000, max: 100_000 },
  { id: "flagship", label: "100K+ Subs", range: "100K+", min: 100_000, max: Number.POSITIVE_INFINITY },
] as const;

export const FREE_DAILY = 4;
export const PLUS_SUBSCRIBER_MIN = 5_000;
export const FLAGSHIP_INDEX = BRACKETS.length - 1;

export function bracketIndex(subscribers: number): number {
  const index = BRACKETS.findIndex((bracket) => subscribers >= bracket.min && subscribers < bracket.max);
  return index === -1 ? FLAGSHIP_INDEX : index;
}

export function isPlusChannel(subscribers: number): boolean {
  return subscribers >= PLUS_SUBSCRIBER_MIN;
}

export function bracketOf(subscribers: number) {
  return BRACKETS[bracketIndex(subscribers)];
}
