/**
 * One-time launch promo. Display and eligibility live here; Checkout applies a
 * Stripe trial only after the server accepts the code. The in-app field is the
 * only place to enter a code — Checkout does not show Stripe's own promo box,
 * because this trial is not a Stripe promotion code.
 *
 * Codes are case-insensitive with spaces ignored, and each has its own trial
 * length and expiry (see PROMO_CODES). Plus monthly or annual only.
 * - THECONSULTANT: 14 days, valid until 2026-10-26T18:40:00-04:00 (expired).
 * - TRYPLUS5: 5 days, valid until 2026-12-31 23:59 America/New_York.
 * Accounts that have already had paid Plus or a Plus trial are not eligible.
 * Invite (referral) Plus is a separate grant and does not use up this trial.
 */
import { PLUS_ANNUAL_OFF_PERCENT, PRICING } from "@/lib/pricing";

export const LAUNCH_PROMO_CODE = "THECONSULTANT";
/** Exclusive end: the code is not valid at or after this instant. */
export const LAUNCH_PROMO_EXPIRES_AT = Date.parse("2026-10-26T18:40:00-04:00");
export const LAUNCH_TRIAL_DAYS = 14;
export const LAUNCH_PROMO_STORAGE_KEY = "smashcollab-launch-promo";

export type PromoCode = {
  /** Normalized code: uppercase, no spaces. */
  code: string;
  trialDays: number;
  /** Exclusive end: the code is not valid at or after this instant. */
  expiresAt: number;
};

export const TRYPLUS5_CODE = "TRYPLUS5";
/** 2026-12-31 23:59 America/New_York (EST, UTC-5). */
export const TRYPLUS5_EXPIRES_AT = Date.parse("2027-01-01T04:59:00Z");
export const TRYPLUS5_TRIAL_DAYS = 5;

export const PROMO_CODES: readonly PromoCode[] = [
  { code: LAUNCH_PROMO_CODE, trialDays: LAUNCH_TRIAL_DAYS, expiresAt: LAUNCH_PROMO_EXPIRES_AT },
  { code: TRYPLUS5_CODE, trialDays: TRYPLUS5_TRIAL_DAYS, expiresAt: TRYPLUS5_EXPIRES_AT },
];

const LAUNCH_PROMO = PROMO_CODES[0];

/** Looks up a code (case-insensitive, spaces ignored). Ignores expiry. */
export function findPromoCode(raw: string): PromoCode | null {
  const normalized = normalizePromoCode(raw);
  if (!normalized) return null;
  return PROMO_CODES.find((entry) => entry.code === normalized) ?? null;
}

export function promoCopy(trialDays: number): string {
  return `${trialDays} days free, then ${PRICING.plusMonthly}/month (or ${PRICING.plusAnnual}/year). Cancel anytime before the trial ends and you won't be charged.`;
}

/** Copy for the original THECONSULTANT launch code. Prefer promoCopy(days). */
export const LAUNCH_PROMO_COPY = promoCopy(LAUNCH_TRIAL_DAYS);

/** Label for the upgrade dialog's checkout button when a code is applied. */
export function trialButtonLabel(trialDays: number): string {
  return `Start ${trialDays}-day free trial`;
}

/** Hint inside the empty promo box. Must never be a real code. */
export const PROMO_CODE_PLACEHOLDER = "Enter promo code";

export const PROMO_INVALID_MESSAGE = "That promo code isn't valid.";
export const PROMO_EXPIRED_MESSAGE = "That promo code has expired.";
export const PROMO_USED_MESSAGE = "That promo code is only for creators who haven't had Plus before.";
export const PROMO_DUE_TODAY =
  "Due today: $0. A card is saved for after the trial. The Stripe page shows this free trial.";

/**
 * Stripe Checkout's "Add promotion code" box stays off. This launch trial is
 * applied on the session itself, and a second box would not recognize the code.
 */
export const COLLECT_STRIPE_PROMOTION_CODES = false;

/** Text Stripe shows under the payment form when the trial is on the session. */
export function trialCheckoutMessage(plan: "month" | "year", promo: PromoCode = LAUNCH_PROMO): string {
  const price = plan === "year" ? `${PRICING.plusAnnual}/year` : `${PRICING.plusMonthly}/month`;
  return `${promo.code} applied: ${promo.trialDays} days free, then ${price}. Due today: $0. Cancel before the trial ends and you won't be charged.`;
}

export type PromoDecision =
  | { ok: true; promo: PromoCode }
  | { ok: false; reason: "invalid" | "expired" | "used"; message: string };

/** Uppercase and drop every whitespace character so "The consultant" matches. */
export function normalizePromoCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** True for any known promo code (expired or not). */
export function isLaunchPromoCode(raw: string): boolean {
  return findPromoCode(raw) != null;
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
  const promo = findPromoCode(input.code);
  if (!promo) {
    return { ok: false, reason: "invalid", message: PROMO_INVALID_MESSAGE };
  }
  const now = input.now ?? Date.now();
  if (now >= promo.expiresAt) {
    return { ok: false, reason: "expired", message: PROMO_EXPIRED_MESSAGE };
  }
  if (input.hadPlus) {
    return { ok: false, reason: "used", message: PROMO_USED_MESSAGE };
  }
  return { ok: true, promo };
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
  params.delete("allow_promotion_codes");
  params.set("subscription_data[trial_period_days]", String(decision.promo.trialDays));
  // A trial is due $0 today. Always collect a card so the subscription can renew.
  params.set("payment_method_collection", "always");
  params.set("metadata[promo]", decision.promo.code);
  params.set("subscription_data[metadata][promo]", decision.promo.code);
  params.set("custom_text[submit][message]", trialCheckoutMessage(input.plan, decision.promo));
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
