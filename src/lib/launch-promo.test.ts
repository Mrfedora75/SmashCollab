import { describe, expect, it } from "vitest";
import {
  COLLECT_STRIPE_PROMOTION_CODES,
  LAUNCH_PROMO_CODE,
  LAUNCH_PROMO_COPY,
  LAUNCH_PROMO_EXPIRES_AT,
  LAUNCH_TRIAL_DAYS,
  PROMO_CODE_PLACEHOLDER,
  PROMO_EXPIRED_MESSAGE,
  PROMO_INVALID_MESSAGE,
  PROMO_USED_MESSAGE,
  TRYPLUS5_EXPIRES_AT,
  promoCopy,
  trialButtonLabel,
  accountHadPlus,
  applyPromoToCheckoutParams,
  evaluateLaunchPromo,
  isLaunchPromoCode,
  normalizePromoCode,
  promoFromSearch,
  trialCheckoutMessage,
} from "@/lib/launch-promo";
import { PLUS_ANNUAL_OFF_PERCENT, PRICING } from "@/lib/pricing";

const BEFORE = LAUNCH_PROMO_EXPIRES_AT - 1;

describe("displayed prices", () => {
  it("matches the live Stripe amounts, with cents", () => {
    expect(PRICING.plusMonthly).toBe("$7.00");
    expect(PRICING.plusAnnual).toBe("$75.60");
    expect(PRICING.extraCollab).toBe("$0.99");
  });

  it("states annual savings as 10% off twelve monthly payments", () => {
    expect(PLUS_ANNUAL_OFF_PERCENT).toBe(10);
    // $7.00 × 12 = $84.00; 10% off is $75.60 (7560 cents).
    expect((700 * 12 * (100 - PLUS_ANNUAL_OFF_PERCENT)) / 100).toBe(7560);
  });
});

describe("launch promo code", () => {
  it("accepts THECONSULTANT with any case and any spaces", () => {
    for (const raw of ["THECONSULTANT", "theconsultant", "The consultant", "THE CONSULTANT", "  the   consultant  "]) {
      expect(normalizePromoCode(raw)).toBe(LAUNCH_PROMO_CODE);
      expect(isLaunchPromoCode(raw)).toBe(true);
      expect(evaluateLaunchPromo({ code: raw, now: BEFORE }).ok).toBe(true);
    }
  });

  it("reads the code from a promo query param", () => {
    expect(promoFromSearch("?promo=theconsultant")).toBe("theconsultant");
    expect(promoFromSearch("promo=The+consultant")).toBe("The consultant");
    expect(isLaunchPromoCode(promoFromSearch("?promo=the%20consultant"))).toBe(true);
  });

  it("rejects LIVE14 and other codes", () => {
    for (const raw of ["LIVE14", "live14", "LIVE 14", "CONSULTANT", ""]) {
      const decision = evaluateLaunchPromo({ code: raw, now: BEFORE });
      expect(decision).toEqual({ ok: false, reason: "invalid", message: PROMO_INVALID_MESSAGE });
    }
  });

  it("expires at 2026-10-26T18:40:00-04:00", () => {
    expect(LAUNCH_PROMO_EXPIRES_AT).toBe(Date.parse("2026-10-26T18:40:00-04:00"));
    expect(evaluateLaunchPromo({ code: "theconsultant", now: BEFORE }).ok).toBe(true);
    expect(evaluateLaunchPromo({ code: "THE CONSULTANT", now: LAUNCH_PROMO_EXPIRES_AT })).toEqual({
      ok: false,
      reason: "expired",
      message: PROMO_EXPIRED_MESSAGE,
    });
  });

  it("is only for accounts that have never had Plus or a trial", () => {
    expect(accountHadPlus({ plusUntil: 0, subscriptionId: null })).toBe(false);
    expect(accountHadPlus({ plusUntil: 1, subscriptionId: null })).toBe(true);
    expect(accountHadPlus({ plusUntil: 0, subscriptionId: "sub_123" })).toBe(true);
    expect(evaluateLaunchPromo({ code: "The consultant", now: BEFORE, hadPlus: false }).ok).toBe(true);
    expect(evaluateLaunchPromo({ code: "The consultant", now: BEFORE, hadPlus: true })).toEqual({
      ok: false,
      reason: "used",
      message: PROMO_USED_MESSAGE,
    });
  });

  it("shows the trial price copy", () => {
    expect(LAUNCH_PROMO_COPY).toBe(
      "14 days free, then $7.00/month (or $75.60/year). Cancel anytime before the trial ends and you won't be charged.",
    );
  });

  it("uses a generic placeholder that is not a real code", () => {
    expect(PROMO_CODE_PLACEHOLDER).toBe("Enter promo code");
    expect(isLaunchPromoCode(PROMO_CODE_PLACEHOLDER)).toBe(false);
    expect(PROMO_CODE_PLACEHOLDER.toUpperCase()).not.toContain(LAUNCH_PROMO_CODE);
  });
});

describe("checkout trial params", () => {
  it("sets a 14-day trial and still collects a card for an eligible Plus plan", () => {
    for (const plan of ["month", "year"] as const) {
      const params = new URLSearchParams();
      const result = applyPromoToCheckoutParams(params, {
        plan,
        promo: "the consultant",
        hadPlus: false,
        now: BEFORE,
      });
      expect(result).toEqual({ error: null });
      expect(params.get("subscription_data[trial_period_days]")).toBe(String(LAUNCH_TRIAL_DAYS));
      expect(params.get("payment_method_collection")).toBe("always");
      expect(params.get("metadata[promo]")).toBe(LAUNCH_PROMO_CODE);
      expect(params.get("subscription_data[metadata][promo]")).toBe(LAUNCH_PROMO_CODE);
      expect(params.get("custom_text[submit][message]")).toBe(trialCheckoutMessage(plan));
      expect(params.has("allow_promotion_codes")).toBe(false);
      expect(params.get("custom_text[submit][message]")).toContain("Due today: $0");
    }
  });

  it("does not ask Stripe Checkout for its own promotion-code field", () => {
    expect(COLLECT_STRIPE_PROMOTION_CODES).toBe(false);
    const params = new URLSearchParams({ allow_promotion_codes: "true" });
    applyPromoToCheckoutParams(params, { plan: "month", promo: "theconsultant", hadPlus: false, now: BEFORE });
    expect(params.has("allow_promotion_codes")).toBe(false);
  });

  it("does not start a trial for a collab, a blank code, an expired code, a used account, or LIVE14", () => {
    const cases = [
      { plan: "collab" as const, promo: "THECONSULTANT", hadPlus: false, now: BEFORE },
      { plan: "month" as const, promo: "   ", hadPlus: false, now: BEFORE },
      { plan: "year" as const, promo: "THECONSULTANT", hadPlus: false, now: LAUNCH_PROMO_EXPIRES_AT },
      { plan: "month" as const, promo: "THE CONSULTANT", hadPlus: true, now: BEFORE },
      { plan: "year" as const, promo: "LIVE14", hadPlus: false, now: BEFORE },
    ];
    for (const input of cases) {
      const params = new URLSearchParams({ mode: "subscription" });
      const result = applyPromoToCheckoutParams(params, input);
      expect(params.get("subscription_data[trial_period_days]")).toBeNull();
      expect(params.get("payment_method_collection")).toBeNull();
      expect(params.get("mode")).toBe("subscription");
      if (input.plan === "collab" || !input.promo.trim()) expect(result.error).toBeNull();
      else expect(result.error).toBeTruthy();
    }
  });
});

describe("TRYPLUS5 code", () => {
  const T_BEFORE = TRYPLUS5_EXPIRES_AT - 1;
  const TODAY = Date.parse("2026-10-30T23:00:00-04:00");

  it("expires at 2026-12-31 23:59 America/New_York", () => {
    expect(TRYPLUS5_EXPIRES_AT).toBe(Date.parse("2027-01-01T04:59:00Z"));
    expect(TRYPLUS5_EXPIRES_AT).toBe(Date.parse("2026-12-31T23:59:00-05:00"));
  });

  it("is valid before expiry, any case and spaces, and gives 5 days", () => {
    for (const raw of ["TRYPLUS5", "tryplus5", "Try Plus 5", "  tryplus 5 "]) {
      for (const now of [TODAY, T_BEFORE]) {
        const decision = evaluateLaunchPromo({ code: raw, now, hadPlus: false });
        expect(decision.ok).toBe(true);
        if (decision.ok) {
          expect(decision.promo.code).toBe("TRYPLUS5");
          expect(decision.promo.trialDays).toBe(5);
        }
      }
    }
  });

  it("is expired at and after the expiry instant", () => {
    for (const now of [TRYPLUS5_EXPIRES_AT, TRYPLUS5_EXPIRES_AT + 60_000]) {
      expect(evaluateLaunchPromo({ code: "tryplus5", now })).toEqual({
        ok: false,
        reason: "expired",
        message: PROMO_EXPIRED_MESSAGE,
      });
    }
  });

  it("still requires an account that never had Plus", () => {
    expect(evaluateLaunchPromo({ code: "TRYPLUS5", now: TODAY, hadPlus: true })).toEqual({
      ok: false,
      reason: "used",
      message: PROMO_USED_MESSAGE,
    });
  });

  it("leaves THECONSULTANT expired today", () => {
    expect(evaluateLaunchPromo({ code: "THECONSULTANT", now: TODAY }).ok).toBe(false);
    expect(evaluateLaunchPromo({ code: "THECONSULTANT", now: TODAY })).toMatchObject({ reason: "expired" });
  });

  it("rejects unknown codes", () => {
    for (const raw of ["TRYPLUS6", "TRYPLUS", "PLUS5", "TRY PLUS FIVE"]) {
      expect(evaluateLaunchPromo({ code: raw, now: TODAY })).toEqual({
        ok: false,
        reason: "invalid",
        message: PROMO_INVALID_MESSAGE,
      });
    }
  });

  it("sets a 5-day trial with a card collected on checkout", () => {
    for (const plan of ["month", "year"] as const) {
      const params = new URLSearchParams();
      const result = applyPromoToCheckoutParams(params, { plan, promo: "tryplus5", hadPlus: false, now: TODAY });
      expect(result).toEqual({ error: null });
      expect(params.get("subscription_data[trial_period_days]")).toBe("5");
      expect(params.get("payment_method_collection")).toBe("always");
      expect(params.get("metadata[promo]")).toBe("TRYPLUS5");
      expect(params.get("subscription_data[metadata][promo]")).toBe("TRYPLUS5");
      const message = params.get("custom_text[submit][message]");
      expect(message).toContain("TRYPLUS5 applied: 5 days free");
      expect(message).toContain("Due today: $0");
    }
  });

  it("does not start a trial for an expired TRYPLUS5 or a used account", () => {
    for (const input of [
      { plan: "month" as const, promo: "TRYPLUS5", hadPlus: false, now: TRYPLUS5_EXPIRES_AT },
      { plan: "year" as const, promo: "TRYPLUS5", hadPlus: true, now: TODAY },
    ]) {
      const params = new URLSearchParams();
      expect(applyPromoToCheckoutParams(params, input).error).toBeTruthy();
      expect(params.get("subscription_data[trial_period_days]")).toBeNull();
    }
  });

  it("shows the code's days on the button and in the copy", () => {
    const decision = evaluateLaunchPromo({ code: "tryplus5", now: TODAY });
    if (!decision.ok) throw new Error("expected TRYPLUS5 to be valid");
    expect(trialButtonLabel(decision.promo.trialDays)).toBe("Start 5-day free trial");
    expect(trialButtonLabel(14)).toBe("Start 14-day free trial");
    expect(promoCopy(decision.promo.trialDays)).toBe(
      "5 days free, then $7.00/month (or $75.60/year). Cancel anytime before the trial ends and you won't be charged.",
    );
    expect(trialCheckoutMessage("month", decision.promo)).toBe(
      "TRYPLUS5 applied: 5 days free, then $7.00/month. Due today: $0. Cancel before the trial ends and you won't be charged.",
    );
  });
});
