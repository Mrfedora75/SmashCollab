import { describe, expect, it } from "vitest";
import {
  LAUNCH_PROMO_CODE,
  LAUNCH_PROMO_COPY,
  LAUNCH_PROMO_EXPIRES_AT,
  LAUNCH_TRIAL_DAYS,
  PROMO_EXPIRED_MESSAGE,
  PROMO_INVALID_MESSAGE,
  PROMO_USED_MESSAGE,
  accountHadPlus,
  applyPromoToCheckoutParams,
  evaluateLaunchPromo,
  isLaunchPromoCode,
  normalizePromoCode,
  promoFromSearch,
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
    }
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
