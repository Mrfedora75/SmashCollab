import { createFileRoute } from "@tanstack/react-router";
import { handleRestoreRequest } from "@/lib/server/session-restore.server";

/** "Continue as @channel": restore the verified session from a fresh Firebase sign-in. See session-restore.server.ts. */
export const Route = createFileRoute("/api/auth/restore")({
  server: {
    handlers: {
      POST: async ({ request }) => handleRestoreRequest(request),
    },
  },
});
