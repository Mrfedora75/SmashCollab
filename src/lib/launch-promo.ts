/**
 * One-time launch promo. Display and eligibility live here; Checkout applies a
 * Stripe trial only after the server accepts the code.
 *
 * Code THECONSULTANT, case-insensitive, spaces ignored.
 * Valid until 2026-10-26T18:40:00-04:00. Plus monthly or annual only.
 * Accounts that have already had paid Plus or a Plus trial are not eligible.
 * Invite (referral) Plus is a separate grant and does not use up this trial.
 */
import { PLUS_ANNUAL_OFF_PERCENT, PRICING } from "@/lib/pricing";

export const LAUNCH_PROMO_CODE = "THECONSULTANT";
/** Exclusive end: the code is not valid at or after this instant. */
export const LAUNCH_PROMO_EXPIRES_AT = Date.parse("2026-10-26T18:40:00-04:00");
export const LAUNCH_TRIAL_DAYS = 14;
export const LAUNCH_PROMO_STORAGE_KEY = "smashcollab-launch-promo";

export const LAUNCH_PROMO_COPY = `14 days free, then ${PRICING.plusMonthly}/month (or ${PRICING.plusAnnual}/year). Cancel anytime before the trial ends and you won't be charged.`;

export const PROMO_INVALID_MESSAGE = "That promo code isn't valid.";
export const PROMO_EXPIRED_MESSAGE = "That promo code has expired.";
export const PROMO_USED_MESSAGE = "That promo code is only for creators who haven't had Plus before.";

export type PromoDecision =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used"; message: string };

/** Uppercase and drop every whitespace character so "The consultant" matches. */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isLaunchPromoCode(raw: string): boolean {
  return normalizePromoCode(raw) === LAUNCH_PROMO_CODE;
}

/**
 * Paid Plus or a previous Plus trial. `plusUntil` stays set after cancel
 * (it is written to "now"), and `subscriptionId` covers a subscription row
 * that has not stamped an end time yet.
 */
export function accountHadPlus(ent: { plusUntil: number; subscriptionId?: string | null }): boolean {
  return ent.plusUntil > 0 || Boolean(ent.subscriptionId);
}

export function evaluateLaunchPromo(input: { code: string; now?: number; hadPlus?: boolean }): PromoDecision {
  if (!isLaunchPromoCode(input.code)) {
    return { ok: false, reason: "invalid", message: PROMO_INVALID_MESSAGE };
  }
  const now = input.now ?? Date.now();
  if (now >= LAUNCH_PROMO_EXPIRES_AT) {
    return { ok: false, reason: "expired", message: PROMO_EXPIRED_MESSAGE };
  }
  if (input.hadPlus) {
    return { ok: false, reason: "used", message: PROMO_USED_MESSAGE };
  }
  return { ok: true };
}

export type CheckoutPlan = "month" | "year" | "collab";

/**
 * Adds the Stripe trial fields when the code is eligible. One-time collab
 * checkout ignores the code. A bad code on a Plus plan returns an error and
 * does not change `params`, so checkout is not started.
 */
export function applyPromoToCheckoutParams(
  params: URLSearchParams,
  input: { plan: CheckoutPlan; promo: string; hadPlus: boolean; now?: number },
): { error: string | null } {
  if (!input.promo.trim() || input.plan === "collab") return { error: null };
  const decision = evaluateLaunchPromo({ code: input.promo, now: input.now, hadPlus: input.hadPlus });
  if (!decision.ok) return { error: decision.message };
  params.set("subscription_data[trial_period_days]", String(LAUNCH_TRIAL_DAYS));
  // A trial is due $0 today. Always collect a card so the subscription can renew.
  params.set("payment_method_collection", "always");
  return { error: null };
}

export function annualSavingsLabel(): string {
  return `${PRICING.plusAnnual}/year (${PLUS_ANNUAL_OFF_PERCENT}% off monthly)`;
}

export function promoFromSearch(search: string): string {
  return new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("promo") ?? "";
}

export function readRememberedPromo(): string {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(LAUNCH_PROMO_STORAGE_KEY) ?? "";
}

export function rememberLaunchPromo(raw: string): void {
  if (typeof sessionStorage === "undefined") return;
  const value = raw.trim();
  if (!value) {
    sessionStorage.removeItem(LAUNCH_PROMO_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(LAUNCH_PROMO_STORAGE_KEY, value);
}

/** Persist `?promo=` for the upgrade screen. Leaves the query string in place. */
export function captureLaunchPromoFromUrl(): void {
  if (typeof window === "undefined") return;
  const raw = new URLSearchParams(window.location.search).get("promo");
  if (raw == null) return;
  rememberLaunchPromo(raw);
}
