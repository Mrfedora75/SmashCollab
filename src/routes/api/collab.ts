import { createFileRoute } from "@tanstack/react-router";
import { handleCollabRequest, handleInboundRequest } from "@/lib/server/collab.server";

/** POST sends a collab. GET lists inbound collabs (identity only for Plus). See collab.server.ts. */
export const Route = createFileRoute("/api/collab")({
  server: {
    handlers: {
      GET: async ({ request }) => handleInboundRequest(request),
      POST: async ({ request }) => handleCollabRequest(request),
    },
  },
});
