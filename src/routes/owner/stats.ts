import { createFileRoute } from "@tanstack/react-router";
import { handleOwnerStatsPage } from "@/lib/server/owner-stats.server";

/** Owner-only stats page. POST the token; it is not accepted in the URL. */
export const Route = createFileRoute("/owner/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOwnerStatsPage(request),
      POST: async ({ request }) => handleOwnerStatsPage(request),
    },
  },
});
