import { createFileRoute } from "@tanstack/react-router";
import { handleCollabRequest } from "@/lib/server/collab.server";

/** Send a collab. Limits are enforced here, not in the browser. See collab.server.ts. */
export const Route = createFileRoute("/api/collab")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCollabRequest(request),
    },
  },
});
