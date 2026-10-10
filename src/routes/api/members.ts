import { createFileRoute } from "@tanstack/react-router";
import { handleMembersRequest } from "@/lib/server/members.server";

/** Paginated public creator profiles for signed-in members. See members.server.ts. */
export const Route = createFileRoute("/api/members")({
  server: {
    handlers: {
      GET: async ({ request }) => handleMembersRequest(request),
    },
  },
});
