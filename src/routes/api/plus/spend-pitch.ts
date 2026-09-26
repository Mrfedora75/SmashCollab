import { createFileRoute } from "@tanstack/react-router";
import { StorageNotConfiguredError } from "@/lib/server/firestore.server";
import { spendPitchCredit } from "@/lib/stripe-billing.server";
import { requestAccount } from "@/lib/youtube/plus-entitlement";

/** Spend one purchased extra pitch for the verified channel in this session. */
export const Route = createFileRoute("/api/plus/spend-pitch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        const account = await requestAccount(request);
        if (!account) return Response.json({ error: "Verify via YouTube first." }, { status: 401, headers });
        try {
          const remaining = await spendPitchCredit(account.channelId);
          if (remaining == null) return Response.json({ error: "No extra pitches left." }, { status: 409, headers });
          return Response.json({ ok: true, pitchCredits: remaining }, { headers });
        } catch (error) {
          const status = error instanceof StorageNotConfiguredError ? 503 : 502;
          return Response.json({ error: "Could not use an extra pitch right now." }, { status, headers });
        }
      },
    },
  },
});
