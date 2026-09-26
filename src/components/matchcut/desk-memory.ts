import type { SavedReview } from "@/components/matchcut/review-modal";

const KEY = "matchcut-desk";

/** Private collab reviews, kept on this device only. Matches and messages live in Firestore. */
export function loadReviews(): Record<string, SavedReview> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { reviews?: Record<string, unknown> };
    const reviews: Record<string, SavedReview> = {};
    for (const [id, review] of Object.entries(parsed.reviews ?? {})) {
      if (!review || typeof review !== "object") continue;
      const saved = review as SavedReview;
      if (typeof saved.stars === "number" && typeof saved.note === "string") reviews[id] = saved;
    }
    return reviews;
  } catch {
    return {};
  }
}

export function saveReviews(reviews: Record<string, SavedReview>) {
  localStorage.setItem(KEY, JSON.stringify({ reviews }));
}
