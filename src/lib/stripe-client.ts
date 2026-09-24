import { useDeck } from "@/lib/deck-store";

const BILLING_KEY = "matchcut-billing-id";
const PURCHASED_KEY = "matchcut-pitches-purchased";
const SOURCE_KEY = "matchcut-plus-source";

export function billingChannelId(): string {
  try {
    const raw = localStorage.getItem("matchcut-profile");
    if (raw) {
      const profile = JSON.parse(raw) as { channelId?: string; channel?: string };
      if (typeof profile.channelId === "string" && profile.channelId.trim()) return profile.channelId.trim();
      if (typeof profile.channel === "string" && profile.channel.trim()) {
        return `handle:${profile.channel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)}`;
      }
    }
  } catch {
    // Fall through to a device id.
  }
  const existing = localStorage.getItem(BILLING_KEY);
  if (existing) return existing;
  const created = `local-${crypto.randomUUID()}`;
  localStorage.setItem(BILLING_KEY, created);
  return created;
}

type BillingResponse = {
  status?: "plus" | "free";
  plusUntil?: number | null;
  pitchesPurchased?: number;
  error?: string;
};

function applyAccount(data: BillingResponse) {
  const deck = useDeck.getState();
  if (data.status === "plus" && typeof data.plusUntil === "number" && data.plusUntil > Date.now()) {
    const existing = deck.premium && typeof deck.premiumUntil === "number" ? deck.premiumUntil : 0;
    if (data.plusUntil > existing) {
      localStorage.setItem(SOURCE_KEY, "stripe");
      deck.setPremium(true, data.plusUntil, "Plus is on.");
    }
  } else if (data.status === "free" && localStorage.getItem(SOURCE_KEY) === "stripe") {
    const until = typeof data.plusUntil === "number" ? data.plusUntil : 0;
    if (until <= Date.now()) deck.setPremium(false);
  }
  const purchased = typeof data.pitchesPurchased === "number" ? data.pitchesPurchased : 0;
  const synced = Number(localStorage.getItem(PURCHASED_KEY) ?? "0");
  if (purchased > synced) {
    useDeck.getState().addPurchasedPitches(purchased - synced);
    localStorage.setItem(PURCHASED_KEY, String(purchased));
  }
}

export async function syncStripeAccount(): Promise<void> {
  const channelId = billingChannelId();
  try {
    const res = await fetch(`/api/stripe/confirm?channelId=${encodeURIComponent(channelId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    applyAccount((await res.json()) as BillingResponse);
  } catch {
    // Leave the local desk alone if billing status cannot be loaded.
  }
}

export async function confirmStripeSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return;
  applyAccount((await res.json()) as BillingResponse);
}

export async function startStripeCheckout(plan: "month" | "year" | "pitch"): Promise<string | null> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ plan, channelId: billingChannelId() }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) return data.error ?? "Checkout could not start.";
  window.location.assign(data.url);
  return null;
}
