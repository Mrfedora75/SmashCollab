/**
 * Stripe billing (server only). Plus and extra pitches are granted ONLY from a
 * Stripe Checkout Session that Stripe itself reports as paid — either via the
 * signed webhook (`/api/stripe/webhook`) or by re-fetching the session from the
 * Stripe API on the success redirect (`/api/stripe/confirm`). Entitlements are
 * stored durably in Firestore, keyed by YouTube channel ID.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import {
  PreconditionFailedError,
  commit,
  getDocument,
  safeDocId,
  type Plain,
  type Write,
} from "@/lib/server/firestore.server";

export type Plan = "month" | "year" | "pitch";

export type Entitlement = {
  channelId: string;
  /** Paid Plus (Stripe subscription) end, ms epoch. */
  plusUntil: number;
  /** Plus granted for accepting an invite, ms epoch. */
  referralPlusUntil: number;
  /** Purchased, unused extra pitches. */
  pitchCredits: number;
  customerId: string | null;
  subscriptionId: string | null;
};

export function stripeSecret(): string | undefined {
  return env("STRIPE_SECRET_KEY");
}

/** Mode from the key prefix only. Never log or return the key itself. */
export function stripeMode(): "test" | "live" | "unknown" | "missing" {
  const key = stripeSecret();
  if (!key) return "missing";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return "unknown";
}

/** Live keys are refused unless the owner explicitly sets STRIPE_ALLOW_LIVE=true. */
export function liveModeBlocked(): boolean {
  return stripeMode() === "live" && env("STRIPE_ALLOW_LIVE") !== "true";
}

export function priceIdFor(plan: Plan): string | undefined {
  if (plan === "month") return env("STRIPE_PRICE_PLUS_MONTHLY");
  if (plan === "year") return env("STRIPE_PRICE_PLUS_ANNUAL");
  return env("STRIPE_PRICE_PITCH");
}

const PRICE_CACHE: Partial<Record<Plan, string>> = {};

const PRICE_LOOKUP = {
  month: "smash_plus_monthly",
  year: "smash_plus_annual",
  pitch: "smash_extra_pitch",
} as const;

const PRICE_AMOUNTS = {
  month: "700",
  year: "7500",
  pitch: "100",
} as const;

export async function resolvePriceId(plan: Plan): Promise<string> {
  const configured = priceIdFor(plan);
  if (configured) return configured;
  const cached = PRICE_CACHE[plan];
  if (cached) return cached;
  const lookup = PRICE_LOOKUP[plan];
  const amount = PRICE_AMOUNTS[plan];
  const existing = await stripeRequest<{ data?: { id?: string; unit_amount?: number; product?: string }[] }>(
    `prices?lookup_keys[]=${lookup}&active=true&limit=1`,
    undefined,
    "GET",
  );
  const found = existing.data?.[0];
  if (found?.id && String(found.unit_amount ?? "") === amount) {
    PRICE_CACHE[plan] = found.id;
    return found.id;
  }
  let productId = typeof found?.product === "string" ? found.product : "";
  if (!productId) {
    const productName = plan === "pitch" ? "Smash Collab Extra Pitch" : "Smash Collab Plus";
    const product = await stripeRequest<{ id: string }>("products", new URLSearchParams({ name: productName }));
    productId = product.id;
  }
  const params = new URLSearchParams({
    product: productId,
    currency: "usd",
    lookup_key: lookup,
    transfer_lookup_key: "true",
    unit_amount: amount,
  });
  if (plan === "pitch") {
    params.set("nickname", "One extra pitch");
  } else {
    params.set("recurring[interval]", plan === "year" ? "year" : "month");
    params.set("nickname", plan === "year" ? "Plus annual" : "Plus monthly");
  }
  const price = await stripeRequest<{ id: string }>("prices", params);
  PRICE_CACHE[plan] = price.id;
  return price.id;
}

export class StripeRequestError extends Error {}

export async function stripeRequest<T>(path: string, params?: URLSearchParams, method = "POST"): Promise<T> {
  const key = stripeSecret();
  if (!key) throw new StripeRequestError("Stripe is not configured.");
  if (liveModeBlocked()) throw new StripeRequestError("Live Stripe keys are disabled for this deployment.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new StripeRequestError(data.error?.message ?? `Stripe request failed (${res.status}).`);
  }
  return data;
}

/** Verifies the `Stripe-Signature` header (v1 HMAC-SHA256, 5-minute tolerance). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const timestamp = header.match(/(?:^|,)t=(\d+)/)?.[1];
  const signatures = [...header.matchAll(/(?:^|,)v1=([a-f0-9]+)/g)].map((match) => match[1]);
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((signature) => {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

// ---- durable entitlements ---------------------------------------------------

function entitlementPath(channelId: string): string {
  return `entitlements/${safeDocId(channelId)}`;
}

function num(value: Plain | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: Plain | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function readEntitlement(channelId: string): Promise<Entitlement> {
  const doc = await getDocument(entitlementPath(channelId));
  return {
    channelId,
    plusUntil: num(doc?.plusUntil),
    referralPlusUntil: num(doc?.referralPlusUntil),
    pitchCredits: Math.max(0, Math.floor(num(doc?.pitchCredits))),
    customerId: str(doc?.customerId),
    subscriptionId: str(doc?.subscriptionId),
  };
}

type StripeSession = {
  id: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  client_reference_id?: string | null;
  customer?: string | { id?: string } | null;
  subscription?: string | StripeSubscription | null;
  metadata?: Record<string, string>;
};

export type StripeSubscription = {
  id?: string;
  status?: string;
  customer?: string | { id?: string } | null;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
};

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

/** Newer Stripe API versions moved current_period_end onto subscription items. */
export function subscriptionPeriodEnd(sub: StripeSubscription): number | null {
  const top = sub.current_period_end;
  const item = sub.items?.data?.[0]?.current_period_end;
  const seconds = typeof top === "number" ? top : typeof item === "number" ? item : null;
  return seconds == null ? null : seconds * 1000;
}

export async function fetchCheckoutSession(sessionId: string): Promise<StripeSession> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new StripeRequestError("Invalid checkout session.");
  return stripeRequest<StripeSession>(`checkout/sessions/${sessionId}?expand[]=subscription`, undefined, "GET");
}

export type ApplyResult = {
  applied: boolean;
  kind: "plus" | "pitch" | null;
  channelId: string | null;
  reason?: string;
};

/**
 * Grants what a paid Checkout Session bought. Idempotent: the session id is
 * recorded in the same atomic commit, so the webhook and the success redirect
 * can both call this without double-granting.
 */
export async function applyCheckoutSession(session: StripeSession): Promise<ApplyResult> {
  const channelId = session.metadata?.channelId?.trim() || null;
  const kind = session.metadata?.kind === "pitch" ? "pitch" : session.metadata?.kind === "plus" ? "plus" : null;
  if (!channelId || !kind) return { applied: false, kind, channelId, reason: "missing-metadata" };
  if (session.status !== "complete" || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    return { applied: false, kind, channelId, reason: "unpaid" };
  }
  const customerId = idOf(session.customer);
  const now = Date.now();
  const writes: Write[] = [
    {
      path: `stripeSessions/${safeDocId(session.id)}`,
      fields: { sessionId: session.id, channelId, kind, createdAt: now },
      precondition: "absent",
    },
  ];
  const base: Record<string, Plain> = { channelId, updatedAt: now };
  if (customerId) base.customerId = customerId;

  if (kind === "pitch") {
    writes.push({ path: entitlementPath(channelId), fields: base, increment: { pitchCredits: 1 } });
  } else {
    let subscription: StripeSubscription | null =
      session.subscription && typeof session.subscription === "object" ? session.subscription : null;
    if (!subscription && typeof session.subscription === "string") {
      subscription = await stripeRequest<StripeSubscription>(`subscriptions/${session.subscription}`, undefined, "GET");
    }
    const periodEnd = subscription ? subscriptionPeriodEnd(subscription) : null;
    const plusUntil = periodEnd ?? now + (session.metadata?.plan === "year" ? 366 : 32) * 24 * 60 * 60 * 1000;
    if (subscription?.id) base.subscriptionId = subscription.id;
    base.plan = session.metadata?.plan === "year" ? "year" : "month";
    writes.push({ path: entitlementPath(channelId), fields: base, maximum: { plusUntil } });
  }

  try {
    await commit(writes);
    return { applied: true, kind, channelId };
  } catch (error) {
    if (error instanceof PreconditionFailedError) return { applied: false, kind, channelId, reason: "already-applied" };
    throw error;
  }
}

/** Keeps Plus in step with subscription renewals, cancellations, and failures. */
export async function applySubscriptionEvent(sub: StripeSubscription, deleted: boolean): Promise<boolean> {
  const channelId = sub.metadata?.channelId?.trim();
  if (!channelId) return false;
  const now = Date.now();
  const periodEnd = subscriptionPeriodEnd(sub);
  const active = !deleted && (sub.status === "active" || sub.status === "trialing");
  const fields: Record<string, Plain> = { channelId, updatedAt: now, subscriptionStatus: deleted ? "canceled" : (sub.status ?? "unknown") };
  const customerId = idOf(sub.customer);
  if (customerId) fields.customerId = customerId;
  if (active && periodEnd) {
    if (sub.id) fields.subscriptionId = sub.id;
    await commit([{ path: entitlementPath(channelId), fields, maximum: { plusUntil: periodEnd } }]);
    return true;
  }
  if (deleted || sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    // End paid Plus now. Referral Plus is stored separately and is not touched.
    fields.plusUntil = now;
    fields.subscriptionId = null;
    await commit([{ path: entitlementPath(channelId), fields }]);
    return true;
  }
  // past_due / incomplete: leave the current period alone; Stripe retries payment.
  await commit([{ path: entitlementPath(channelId), fields }]);
  return true;
}

/** Spend one purchased pitch credit. Returns remaining credits, or null if none were left. */
export async function spendPitchCredit(channelId: string): Promise<number | null> {
  const current = await readEntitlement(channelId);
  if (current.pitchCredits <= 0) return null;
  await commit([
    { path: entitlementPath(channelId), fields: { channelId, updatedAt: Date.now() }, increment: { pitchCredits: -1 } },
  ]);
  return current.pitchCredits - 1;
}

/** Grant invite Plus to the invited creator (does not shorten existing time). */
export async function grantReferralPlus(channelId: string, until: number): Promise<void> {
  await commit([
    { path: entitlementPath(channelId), fields: { channelId, updatedAt: Date.now() }, maximum: { referralPlusUntil: until } },
  ]);
}
