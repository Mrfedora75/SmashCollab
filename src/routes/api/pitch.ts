import { createFileRoute } from "@tanstack/react-router";
import { handlePitchRequest } from "@/lib/server/pitch.server";

/** Send a pitch. Limits are enforced here, not in the browser. See pitch.server.ts. */
export const Route = createFileRoute("/api/pitch")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePitchRequest(request),
    },
  },
});
