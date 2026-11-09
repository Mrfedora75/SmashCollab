import { createFileRoute } from "@tanstack/react-router";
import { handleOwnerStatsApi } from "@/lib/server/owner-stats.server";

/** Owner-only signup counts (Bearer OWNER_STATS_TOKEN). See owner-stats.server.ts. */
export const Route = createFileRoute("/api/owner/stats")({
  server: { handlers: { GET: async ({ request }) => handleOwnerStatsApi(request) } },
});
