/**
 * GET /api/members: the creators a signed-in member can browse.
 *
 * Replaces the old client-side `getDocs(collection("users"))`, which let every
 * signed-in user download every full profile. Now the server returns one page at
 * a time, only profiles that are public (verified YouTube channel + age confirmed),
 * not paused ("Pause collabs"), and only the public fields (PUBLIC_PROFILE_FIELDS). firestore.rules no longer lets
 * a browser read anyone else's users/{uid} document.
 */
import { MEMBERS_PAGE_SIZE, isDiscoverableProfile, isPublicProfile, publicProfileView } from "@/lib/profile-policy";
import { requestFirebaseUser } from "@/lib/server/firebase-auth.server";
import { isStorageConfigured, queryPage, type Plain } from "@/lib/server/firestore.server";
import { readChannelRecord, type ChannelRecord } from "@/lib/server/public-profile.server";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Public card identity comes from the server channel record written at YouTube
 * verification. The profile document's channel, channelId, and avgViews are
 * client-writable on create, so they are not the verified identity.
 */
export function verifiedPublicView(doc: Record<string, Plain>, record: ChannelRecord | null): Record<string, unknown> | null {
  if (!isPublicProfile(doc)) return null;
  const view = publicProfileView(doc) as Record<string, unknown>;
  view.channelId = typeof doc.verifiedChannelId === "string" ? doc.verifiedChannelId : "";
  if (record?.channel) view.channel = record.channel;
  if (typeof record?.avgViews === "number") view.avgViews = record.avgViews;
  else delete view.avgViews;
  if (record?.subscriberCount != null) view.subscriberCount = record.subscriberCount;
  return view;
}

export async function handleMembersRequest(
  request: Request,
  query = queryPage,
  readChannel: (channelId: string) => Promise<ChannelRecord | null> = readChannelRecord,
): Promise<Response> {
  const identity = await requestFirebaseUser(request);
  if (!identity) return json({ error: "Sign in again." }, 401);
  if (!isStorageConfigured()) return json({ error: "Creators are unavailable right now." }, 503);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const requested = Number(url.searchParams.get("limit") ?? MEMBERS_PAGE_SIZE);
  const limit = Number.isFinite(requested) ? Math.min(MEMBERS_PAGE_SIZE, Math.max(1, Math.floor(requested))) : MEMBERS_PAGE_SIZE;
  if (cursor != null && (cursor.length > 128 || cursor.includes("/"))) return json({ error: "Invalid cursor." }, 400);
  try {
    const page = await query("users", { field: "ageConfirmed", equals: true }, limit, cursor);
    const members = [];
    for (const doc of page.docs) {
      if (doc.id === identity.uid || !isDiscoverableProfile(doc.data)) continue;
      const verifiedId = typeof doc.data.verifiedChannelId === "string" ? doc.data.verifiedChannelId : "";
      const record = verifiedId ? await readChannel(verifiedId) : null;
      const view = verifiedPublicView(doc.data, record);
      if (!view || typeof view.channel !== "string" || !view.channel.trim()) continue;
      members.push({ id: doc.id, ...view });
    }
    return json({ members, nextCursor: page.nextId });
  } catch {
    return json({ error: "Could not load creators right now." }, 503);
  }
}
