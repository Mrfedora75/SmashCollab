import { createFileRoute } from "@tanstack/react-router";
import {
  buildPlusCookie,
  clearPlusCookie,
  PLUS_COOKIE,
  readPlusEntitlement,
  readYtAccount,
  signPlusEntitlement,
  YT_ACCOUNT_COOKIE,
} from "@/lib/youtube/plus-entitlement";
import {
  parseCookieHeader,
  readVerifiedChannel,
  YT_CHANNEL_COOKIE,
} from "@/lib/youtube/session";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type GrantBody = {
  until?: number;
  days?: number;
  source?: string;
  clear?: boolean;
};

async function resolveChannelId(request: Request): Promise<string | null> {
  const cookies = parseCookieHeader(request);
  const account = await readYtAccount(cookies[YT_ACCOUNT_COOKIE]);
  if (account?.channelId) return account.channelId;
  const verified = await readVerifiedChannel(cookies[YT_CHANNEL_COOKIE]);
  return verified?.channelId ?? null;
}

export const Route = createFileRoute("/api/plus/grant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const channelId = await resolveChannelId(request);
        if (!channelId) {
          return Response.json(
            { error: "YouTube account required. Verify via YouTube first." },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        let body: GrantBody = {};
        try {
          body = (await request.json()) as GrantBody;
        } catch {
          body = {};
        }

        if (body.clear === true) {
          const headers = new Headers({
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          });
          headers.append("Set-Cookie", clearPlusCookie(request));
          return new Response(
            JSON.stringify({ ok: true, premium: false, premiumUntil: null, channelId }),
            { status: 200, headers },
          );
        }

        let premiumUntil: number;
        if (
          typeof body.until === "number" &&
          Number.isFinite(body.until) &&
          body.until > Date.now()
        ) {
          premiumUntil = Math.floor(body.until);
        } else if (
          typeof body.days === "number" &&
          Number.isFinite(body.days) &&
          body.days > 0
        ) {
          premiumUntil = Date.now() + Math.floor(body.days) * 24 * 60 * 60 * 1000;
        } else {
          premiumUntil = Date.now() + THIRTY_DAYS_MS;
        }

        const source =
          typeof body.source === "string" ? body.source.slice(0, 64) : undefined;
        const token = await signPlusEntitlement({
          channelId,
          premiumUntil,
          source,
        });

        const headers = new Headers({
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        });
        headers.append("Set-Cookie", buildPlusCookie(request, token, premiumUntil));

        return new Response(
          JSON.stringify({
            ok: true,
            premium: true,
            premiumUntil,
            channelId,
            source: source ?? null,
          }),
          { status: 200, headers },
        );
      },

      GET: async ({ request }) => {
        const channelId = await resolveChannelId(request);
        if (!channelId) {
          return Response.json(
            { premium: false, premiumUntil: null, channelId: null },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        }
        const cookies = parseCookieHeader(request);
        const plus = await readPlusEntitlement(cookies[PLUS_COOKIE]);
        if (!plus || plus.channelId !== channelId) {
          return Response.json(
            { premium: false, premiumUntil: null, channelId },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        }
        return Response.json(
          {
            premium: true,
            premiumUntil: plus.premiumUntil,
            channelId,
            source: plus.source ?? null,
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
