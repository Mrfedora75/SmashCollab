import { createFileRoute } from "@tanstack/react-router";
import { handleCustomTokenRequest } from "@/lib/server/custom-token.server";

/** Restore the Firebase session from the verified-channel cookie. See custom-token.server.ts. */
export const Route = createFileRoute("/api/firebase/custom-token")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCustomTokenRequest(request),
    },
  },
});
