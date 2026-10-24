import { createFileRoute } from "@tanstack/react-router";
import { getAppHomeUrl } from "@/lib/youtube/config";
import { resumeYouTubeGrant } from "@/lib/youtube/oauth-result";

/** Load the channel again with the token saved after a failed sign-in. No new Google consent. */
export const Route = createFileRoute("/api/youtube/retry")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const home = getAppHomeUrl(request);
        return resumeYouTubeGrant(request, home);
      },
    },
  },
});
