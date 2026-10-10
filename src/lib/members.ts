import type { Creator, ProfileCountry, UsState } from "@/data/creators";
import { PROFILE_COUNTRIES, US_STATES } from "@/data/creators";
import { firebaseAuth } from "@/lib/firebase";
import { MEMBERS_MAX_PER_SESSION, MEMBERS_PAGE_SIZE } from "@/lib/profile-policy";
import { isDisplayableAvatar } from "@/lib/avatar";

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
  const avatar = isDisplayableAvatar(data.avatar) ? data.avatar : null;
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
    // Prefer the server-verified count (YouTube Data API); the legacy field is display-only.
    subscribers: typeof data.subscriberCount === "number" ? asNumber(data.subscriberCount) : asNumber(data.subscribers),
    // Server-controlled Plus flag; plusUntil lets an expired badge disappear without a write.
    plus: data.plus === true && typeof data.plusUntil === "number" && data.plusUntil > Date.now(),
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

export async function loadMemberCreators(self: { channelId?: string; channel?: string }): Promise<{
  members: Creator[];
  status: "ready" | "auth";
}> {
  const auth = await firebaseAuth();
  await auth?.authStateReady();
  const user = auth?.currentUser ?? null;
  if (!user) return { members: [], status: "auth" };
  const token = await user.getIdToken();
  const ownChannel = self.channel?.replace(/^@/, "").trim().toLowerCase() ?? "";
  const members: Creator[] = [];
  let cursor: string | null = null;
  // Public profiles only, a page at a time, from the server (see /api/members).
  do {
    const params = new URLSearchParams({ limit: String(MEMBERS_PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/members?${params}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { members: [], status: "auth" };
    if (!res.ok) throw new Error("Could not load creators right now.");
    const data = (await res.json()) as { members?: (Record<string, unknown> & { id: string })[]; nextCursor?: string | null };
    for (const item of data.members ?? []) {
      if (item.id === user.uid || (self.channelId && item.channelId === self.channelId)) continue;
      const creator = creatorFromMember(item.id, item);
      if (!creator) continue;
      const handle = creator.channel.replace(/^@/, "").trim().toLowerCase();
      if (ownChannel && handle === ownChannel) continue;
      members.push(creator);
    }
    cursor = typeof data.nextCursor === "string" ? data.nextCursor : null;
  } while (cursor && members.length < MEMBERS_MAX_PER_SESSION);
  return { members, status: "ready" };
}
