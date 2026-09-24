import { createFileRoute } from "@tanstack/react-router";
import { claimReferral, referralStatus } from "@/lib/referrals.server";

export const Route = createFileRoute("/api/referrals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("code") ?? "";
        const status = await referralStatus(code);
        return Response.json(status, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        let body: { code?: string; refereeId?: string } = {};
        try {
          body = (await request.json()) as { code?: string; refereeId?: string };
        } catch {
          body = {};
        }
        if (typeof body.code !== "string" || typeof body.refereeId !== "string") {
          return Response.json({ error: "Referral code required." }, { status: 400 });
        }
        const result = await claimReferral(body.code, body.refereeId);
        return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
