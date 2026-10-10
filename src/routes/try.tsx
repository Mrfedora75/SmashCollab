import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/marketing/public-page";
import { GuestDesk } from "@/components/marketing/guest-desk";

export const Route = createFileRoute("/try")({
  head: () => ({
    meta: [
      { title: "Try Smash Collab (guest mode, sample channels)" },
      { name: "description", content: "Browse sample creator channels and try the collab flow without signing in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TryPage,
});

function TryPage() {
  return (
    <PublicPage>
      <h1 className="mb-6 text-center font-display text-4xl leading-tight">Try it as a guest</h1>
      <GuestDesk />
    </PublicPage>
  );
}
