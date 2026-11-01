import { createFileRoute } from "@tanstack/react-router";
import { handleOwnerStatsPage } from "@/lib/server/owner-stats.server";

/** Owner-only stats page (?key=OWNER_STATS_TOKEN). Plain server HTML, noindex, no analytics. */
export const Route = createFileRoute("/owner/stats")({
  server: { handlers: { GET: async ({ request }) => handleOwnerStatsPage(request) } },
});
