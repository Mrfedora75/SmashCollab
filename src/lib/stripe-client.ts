import { useDeck } from "@/lib/deck-store";
import { fetchPlusFromServer, parseServerPlus, type ServerPlus } from "@/lib/youtube/plus-client";

/** Apply the server's (durable) Plus status to the desk. The server is the source of truth. */
export function applyServerPlus(status: ServerPlus, announcement?: string) {
  const deck = useDeck.getState();
  if (status.storage === "signed-out") return;
  if (status.premium && status.premiumUntil) {
    if (!deck.premium || deck.premiumUntil !== status.premiumUntil) {
      deck.setPremium(true, status.premiumUntil, announcement ?? "Plus is on.");
    }
  } else if (status.storage !== "error" && deck.premium) {
    deck.setPremium(false, null, "Plus is not active on this channel.");
  }
  if (status.storage === "ok") deck.setPurchasedPitches(status.pitchCredits);
}

export async function syncStripeAccount(): Promise<void> {
  const status = await fetchPlusFromServer();
  if (status) applyServerPlus(status);
}

/** Returns a message for the owner-facing toast. Never marks Plus active without the server confirming payment. */
export async function confirmStripeSession(sessionId: string): Promise<string> {
  try {
    const res = await fetch(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as { paid?: boolean; kind?: string; error?: string };
    if (!res.ok) return data.error ?? "We could not confirm that payment yet.";
    applyServerPlus(parseServerPlus(data), data.kind === "pitch" ? "1 extra pitch is ready." : "Plus is on. Thanks!");
    if (!data.paid) return "Payment is still processing. Plus turns on as soon as Stripe confirms it.";
    return data.kind === "pitch" ? "Extra pitch added." : "Plus is on. Thanks!";
  } catch {
    return "We could not confirm that payment yet.";
  }
}

export async function startStripeCheckout(plan: "month" | "year" | "pitch"): Promise<string | null> {
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) return data.error ?? "Checkout could not start.";
    window.location.assign(data.url);
    return null;
  } catch {
    return "Checkout could not start.";
  }
}
