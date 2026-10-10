/**
 * GET /api/members: the creators a signed-in member can browse.
 *
 * Replaces the old client-side `getDocs(collection("users"))`, which let every
 * signed-in user download every full profile. Now the server returns one page at
 * a time, only profiles that are public (verified YouTube channel + age confirmed),
 * and only the public fields (PUBLIC_PROFILE_FIELDS). firestore.rules no longer lets
 * a browser read anyone else's users/{uid} document.
 */
import { MEMBERS_PAGE_SIZE, isPublicProfile, publicProfileView } from "@/lib/profile-policy";
import { requestFirebaseUser } from "@/lib/server/firebase-auth.server";
import { isStorageConfigured, queryPage } from "@/lib/server/firestore.server";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleMembersRequest(request: Request, query = queryPage): Promise<Response> {
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
    const members = page.docs
      .filter((doc) => doc.id !== identity.uid && isPublicProfile(doc.data))
      .map((doc) => ({ id: doc.id, ...publicProfileView(doc.data) }));
    return json({ members, nextCursor: page.nextId });
  } catch {
    return json({ error: "Could not load creators right now." }, 503);
  }
}
