import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import type { Creator, ProfileCountry, UsState } from "@/data/creators";
import { PROFILE_COUNTRIES, US_STATES } from "@/data/creators";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

const FALLBACK_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#1c1410"/><circle cx="8" cy="4.5" r="1.4" fill="#c4553a"/></svg>`,
  );

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function creatorFromMember(id: string, data: Record<string, unknown>): Creator | null {
  const channel = typeof data.channel === "string" ? data.channel.trim() : "";
  if (!channel) return null;
  const niches = Array.isArray(data.niches)
    ? data.niches.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const avatar = typeof data.avatar === "string" && /^https?:\/\//.test(data.avatar) ? data.avatar : null;
  const bio = typeof data.bio === "string" ? data.bio.trim() : "";
  const name = typeof data.displayName === "string" ? data.displayName.trim() : "";
  const country = PROFILE_COUNTRIES.some((item) => item.id === data.country) ? (data.country as ProfileCountry) : "";
  const state =
    country === "us" && typeof data.state === "string" && (US_STATES as readonly string[]).includes(data.state)
      ? (data.state as UsState)
      : null;
  const county = typeof data.county === "string" ? data.county.trim().slice(0, 40) : "";
  const location = country === "us" || country === "uk" || country === "europe" || country === "latam" ? country : "remote";
  return {
    id,
    name: name || channel,
    channel,
    subscribers: asNumber(data.subscribers),
    avgViews: asNumber(data.avgViews),
    niches,
    location,
    state,
    county: county || null,
    videoTitle: bio || "Open to collabs",
    duration: "Live",
    thumb: avatar ?? FALLBACK_THUMB,
    openTo: bio || "Open to collabs",
    fit: 0,
    rating: 0,
  };
}

async function waitForAuthUser() {
  const auth = firebaseAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  await new Promise<void>((resolve) => {
    const stop = onAuthStateChanged(auth, () => {
      stop();
      resolve();
    });
  });
  return auth.currentUser;
}

export async function loadMemberCreators(self: { channelId?: string; channel?: string }): Promise<{
  members: Creator[];
  status: "ready" | "auth";
}> {
  const db = firebaseDb();
  const user = await waitForAuthUser();
  if (!db || !user) return { members: [], status: "auth" };
  const snap = await getDocs(collection(db, "users"));
  const ownChannel = self.channel?.replace(/^@/, "").trim().toLowerCase() ?? "";
  const members = snap.docs
    .filter((item) => {
      if (item.id === user.uid) return false;
      const data = item.data() as Record<string, unknown>;
      return !(self.channelId && data.channelId === self.channelId);
    })
    .map((item) => creatorFromMember(item.id, item.data() as Record<string, unknown>))
    .filter((creator): creator is Creator => {
      if (!creator) return false;
      const handle = creator.channel.replace(/^@/, "").trim().toLowerCase();
      return !ownChannel || handle !== ownChannel;
    });
  return { members, status: "ready" };
}
