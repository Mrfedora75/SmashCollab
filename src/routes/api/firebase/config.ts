import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]+|['"]+$/g, "");
}

export const Route = createFileRoute("/api/firebase/config")({
  server: {
    handlers: {
      GET: async () => {
        const config = {
          apiKey: clean(env("VITE_FIREBASE_API_KEY")),
          authDomain: clean(env("VITE_FIREBASE_AUTH_DOMAIN")),
          projectId: clean(env("VITE_FIREBASE_PROJECT_ID")),
          storageBucket: clean(env("VITE_FIREBASE_STORAGE_BUCKET")),
          messagingSenderId: clean(env("VITE_FIREBASE_MESSAGING_SENDER_ID")),
          appId: clean(env("VITE_FIREBASE_APP_ID")),
          measurementId: clean(env("VITE_FIREBASE_MEASUREMENT_ID")),
        };
        return new Response(JSON.stringify(config), {
          status: config.apiKey ? 200 : 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
