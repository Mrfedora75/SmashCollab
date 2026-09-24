import { createFileRoute } from "@tanstack/react-router";
import { MatchcutApp } from "@/components/matchcut/shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MatchcutApp />;
}
