/**
 * SAMPLE channels for guest mode (/try). These are made up, never stored, and never
 * mixed with real members: ids start with "sample-", names end in "(Sample)", and
 * guest mode never touches Firestore, the deck store, or the real /api routes.
 */
import type { Creator } from "@/data/creators";

export const SAMPLE_ID_PREFIX = "sample-";

const thumb = (hue: number) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="hsl(${hue} 35% 18%)"/><text x="8" y="5.6" font-size="2" text-anchor="middle" fill="#f4ead9" font-family="sans-serif">SAMPLE</text></svg>`,
  );

const base = { duration: "Sample", fit: 0, rating: 0, county: null, plus: false } as const;

export const SAMPLE_CREATORS: Creator[] = [
  { ...base, id: "sample-1", name: "Pixel Pantry (Sample)", channel: "@sample-pixelpantry", subscribers: 1_800, avgViews: 950, niches: ["Cooking"], location: "us", state: "Ohio", videoTitle: "Sample channel: 5-minute dorm meals", thumb: thumb(14), openTo: "Sample channel: open to recipe swaps" },
  { ...base, id: "sample-2", name: "Trailhead Tess (Sample)", channel: "@sample-trailheadtess", subscribers: 3_400, avgViews: 2_100, niches: ["Travel"], location: "uk", state: null, videoTitle: "Sample channel: wild camping on a budget", thumb: thumb(120), openTo: "Sample channel: open to joint vlogs" },
  { ...base, id: "sample-3", name: "Speedrun Sam (Sample)", channel: "@sample-speedrunsam", subscribers: 820, avgViews: 400, niches: ["Gaming"], location: "remote", state: null, videoTitle: "Sample channel: any% attempts", thumb: thumb(260), openTo: "Sample channel: open to co-op streams" },
  { ...base, id: "sample-4", name: "Studio Lumen (Sample)", channel: "@sample-studiolumen", subscribers: 12_500, avgViews: 6_000, niches: ["Tech"], location: "europe", state: null, videoTitle: "Sample channel: budget camera tests", thumb: thumb(200), openTo: "Sample channel: open to gear comparisons" },
];
