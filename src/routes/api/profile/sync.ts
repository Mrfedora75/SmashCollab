import { createFileRoute } from "@tanstack/react-router";
import { utcDayKey } from "@/lib/pitch-policy";
import { requestFirebaseUser } from "@/lib/server/firebase-auth.server";
import { getDocument, isStorageConfigured, safeDocId } from "@/lib/server/firestore.server";
import { ProfileBindError, bindProfileToChannel, syncPublicPlus, userPath } from "@/lib/server/public-profile.server";
import { requestAccount } from "@/lib/youtube/plus-entitlement";

const noStore = { "Cache-Control": "no-store" };

/**
 * Links the signed-in Firebase profile to the YouTube channel verified in this
 * session and writes the server-controlled profile fields (subscriber count
 * from the YouTube Data API, Plus status). Also returns today's free-pitch usage.
 */
export const Route = createFileRoute("/api/profile/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const identity = await requestFirebaseUser(request);
        if (!identity) return Response.json({ error: "Sign in again." }, { status: 401, headers: noStore });
        if (!isStorageConfigured()) {
          return Response.json({ linked: false, storage: "unconfigured" }, { headers: noStore });
        }
        try {
          const account = await requestAccount(request);
          let linked = false;
          let subscriberCount: number | null = null;
          let plus = false;
          if (account) {
            const result = await bindProfileToChannel(identity, account);
            linked = true;
            subscriberCount = result.subscriberCount;
            plus = result.plus.premium;
          } else {
            const profile = await getDocument(userPath(identity.uid));
            const channelId = typeof profile?.verifiedChannelId === "string" ? profile.verifiedChannelId : null;
            if (channelId) {
              linked = true;
              await syncPublicPlus(channelId);
            }
          }
          const day = utcDayKey();
          const usage = await getDocument(`pitchUsage/${safeDocId(identity.uid)}`);
          const freeUsedToday = usage?.day === day && typeof usage.count === "number" ? usage.count : 0;
          return Response.json({ linked, subscriberCount, plus, day, freeUsedToday, storage: "ok" }, { headers: noStore });
        } catch (error) {
          if (error instanceof ProfileBindError) {
            return Response.json({ error: error.message }, { status: error.status, headers: noStore });
          }
          return Response.json({ error: "Could not sync your profile right now." }, { status: 503, headers: noStore });
        }
      },
    },
  },
});
