import { createFileRoute } from "@tanstack/react-router";
import { referralCode } from "@/lib/referrals";
import { claimReferral, referralStatus, registerReferralCode } from "@/lib/referrals.server";
import { StorageNotConfiguredError, isStorageConfigured } from "@/lib/server/firestore.server";
import { requestAccount } from "@/lib/youtube/plus-entitlement";

const noStore = { "Cache-Control": "no-store" };

export const Route = createFileRoute("/api/referrals")({
  server: {
    handlers: {
      /** Invite status for the signed-in creator's own code only. */
      GET: async ({ request }) => {
        const account = await requestAccount(request);
        if (!account?.channel) return Response.json({ error: "Verify via YouTube first." }, { status: 401, headers: noStore });
        if (!isStorageConfigured()) return Response.json({ invites: 0, plusUntil: 0, storage: "unconfigured" }, { headers: noStore });
        const code = referralCode(account.channel);
        try {
          await registerReferralCode(code, account.channelId);
          return Response.json({ code, ...(await referralStatus(code)) }, { headers: noStore });
        } catch {
          return Response.json({ error: "Invite status is unavailable right now." }, { status: 503, headers: noStore });
        }
      },
      /** Claim an invite as the signed-in (verified) creator. */
      POST: async ({ request }) => {
        const account = await requestAccount(request);
        if (!account) return Response.json({ error: "Verify via YouTube first." }, { status: 401, headers: noStore });
        let body: { code?: unknown } = {};
        try {
          body = (await request.json()) as { code?: unknown };
        } catch {
          body = {};
        }
        if (typeof body.code !== "string" || !body.code.trim() || body.code.length > 80) {
          return Response.json({ error: "Referral code required." }, { status: 400, headers: noStore });
        }
        try {
          const result = await claimReferral(body.code, account);
          return Response.json(result, { status: result.ok ? 200 : 422, headers: noStore });
        } catch (error) {
          const status = error instanceof StorageNotConfiguredError ? 503 : 502;
          return Response.json({ error: "Invites are unavailable right now." }, { status, headers: noStore });
        }
      },
    },
  },
});
