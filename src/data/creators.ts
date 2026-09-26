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

export const VIEWER = {
  displayName: "Alex North",
  channel: "Northroom",
  subscribers: 96_000,
  avgViews: 22_400,
  niches: ["Cooking", "Home"] as const,
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

export const CREATORS: Creator[] = [
  {
    id: "mara",
    name: "Mara Ellison",
    channel: "Weeknight Kitchen",
    subscribers: 186_000,
    avgViews: 42_000,
    niches: ["Cooking", "Home"],
    location: "us",
    state: "Pennsylvania",
    videoTitle: "Weeknight Pasta, No Panic",
    duration: "12:41",
    thumb: "/thumbs/mara.jpg",
    openTo: "Guest cooks and recipe swaps",
    fit: 94,
    rating: 4.8,
  },
  {
    id: "cam",
    name: "Cam Reyes",
    channel: "Field Notes",
    subscribers: 28_000,
    avgViews: 9_400,
    niches: ["Travel", "Cooking"],
    location: "latam",
    state: null,
    videoTitle: "48 Hours in Oaxaca's Markets",
    duration: "16:20",
    thumb: "/thumbs/cam.jpg",
    openTo: "Market walks and cooking on the road",
    fit: 84,
    rating: 4.6,
  },
  {
    id: "reed",
    name: "Reed Calder",
    channel: "One Sheet",
    subscribers: 145_000,
    avgViews: 51_000,
    niches: ["DIY", "Home"],
    location: "us",
    state: "Ohio",
    videoTitle: "A Bookshelf From One Sheet",
    duration: "15:11",
    thumb: "/thumbs/reed.jpg",
    openTo: "Build-alongs in a shared shop",
    fit: 76,
    rating: 4.9,
  },
  {
    id: "sable",
    name: "Sable Finch",
    channel: "Ridge Route",
    subscribers: 92_000,
    avgViews: 38_000,
    niches: ["Travel", "Paranormal"],
    location: "us",
    state: "Colorado",
    videoTitle: "The Ridge That Ate Our Map",
    duration: "22:14",
    thumb: "/thumbs/sable.jpg",
    openTo: "Trail days and travel crossovers",
    fit: 64,
    rating: 4.4,
  },
  {
    id: "jules",
    name: "Jules Okonkwo",
    channel: "Bench Notes",
    subscribers: 640_000,
    avgViews: 210_000,
    niches: ["Tech", "DIY"],
    location: "uk",
    state: null,
    videoTitle: "I Rebuilt This Laptop for $90",
    duration: "18:05",
    thumb: "/thumbs/jules.jpg",
    openTo: "Teardowns and tool crossovers",
    fit: 58,
    rating: 4.7,
  },
  {
    id: "priya",
    name: "Priya Shah",
    channel: "Ledger",
    subscribers: 540_000,
    avgViews: 160_000,
    niches: ["Finance", "Education"],
    location: "uk",
    state: null,
    videoTitle: "The Index Fund Myth",
    duration: "14:33",
    thumb: "/thumbs/priya.jpg",
    openTo: "Explainers with a personal money story",
    fit: 48,
    rating: 4.5,
  },
  {
    id: "amos",
    name: "Amos Quinn",
    channel: "Chalk",
    subscribers: 890_000,
    avgViews: 310_000,
    niches: ["Education"],
    location: "us",
    state: "New York",
    videoTitle: "Why Your Brain Forgets Names",
    duration: "13:27",
    thumb: "/thumbs/amos.jpg",
    openTo: "Classroom crossovers and myth busting",
    fit: 45,
    rating: 4.8,
  },
  {
    id: "nia",
    name: "Nia Park",
    channel: "Form Lab",
    subscribers: 310_000,
    avgViews: 95_000,
    niches: ["Fitness"],
    location: "us",
    state: "New York",
    videoTitle: "20 Minutes. No Equipment.",
    duration: "11:02",
    thumb: "/thumbs/nia.jpg",
    openTo: "Short joint workouts",
    fit: 42,
    rating: 4.3,
  },
  {
    id: "hana",
    name: "Hana Ito",
    channel: "Still Life",
    subscribers: 8_400,
    avgViews: 2_100,
    niches: ["Beauty"],
    location: "europe",
    state: null,
    videoTitle: "The Only Blush I Repurchased",
    duration: "9:48",
    thumb: "/thumbs/hana.jpg",
    openTo: "Get-ready videos and product honesty",
    fit: 36,
    rating: 4.9,
  },
  {
    id: "lumen",
    name: "Lumen Choir",
    channel: "Room Tone",
    subscribers: 18_000,
    avgViews: 6_200,
    niches: ["Music", "80s/90s Nostalgia"],
    location: "uk",
    state: null,
    videoTitle: "A Song Recorded in a Stairwell",
    duration: "8:05",
    thumb: "/thumbs/lumen.jpg",
    openTo: "One-song features and room recordings",
    fit: 33,
    rating: 4.2,
  },
  {
    id: "theo",
    name: "Theo Voss",
    channel: "Late Game",
    subscribers: 1_200_000,
    avgViews: 480_000,
    niches: ["Gaming", "80s/90s Nostalgia"],
    location: "us",
    state: "California",
    videoTitle: "This Co-op Ruined Our Friendship",
    duration: "28:40",
    thumb: "/thumbs/theo.jpg",
    openTo: "Co-op sessions and one-off duos",
    fit: 30,
    rating: 4.1,
  },
  {
    id: "vera",
    name: "Vera Lang",
    channel: "Casefile",
    subscribers: 1_800_000,
    avgViews: 720_000,
    niches: ["True Crime", "Paranormal"],
    location: "europe",
    state: null,
    videoTitle: "The Postcard That Didn't Add Up",
    duration: "34:02",
    thumb: "/thumbs/vera.jpg",
    openTo: "Cold-case stories, no reenactments",
    fit: 28,
    rating: 4.6,
  },
];
