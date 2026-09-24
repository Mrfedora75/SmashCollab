import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { getSql } from "@/lib/db";
import { env } from "@/lib/env.server";

const FILE = "/tmp/smash-stripe.json";

export type BillingAccount = {
  channelId: string;
  status: "plus" | "free";
  plusUntil: number | null;
  pitchesPurchased: number;
  customerId: string | null;
  subscriptionId: string | null;
};

type Ledger = {
  accounts: Record<string, BillingAccount>;
  sessions: string[];
};

const memory = globalThis as typeof globalThis & { __smashStripe?: Ledger };

function emptyLedger(): Ledger {
  return { accounts: {}, sessions: [] };
}

function readLedger(): Ledger {
  if (memory.__smashStripe) return memory.__smashStripe;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Ledger>;
    memory.__smashStripe = {
      accounts: parsed.accounts && typeof parsed.accounts === "object" ? parsed.accounts : {},
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.filter((id) => typeof id === "string") : [],
    };
  } catch {
    memory.__smashStripe = emptyLedger();
  }
  return memory.__smashStripe;
}

function writeLedger(ledger: Ledger) {
  memory.__smashStripe = ledger;
  try {
    writeFileSync(FILE, JSON.stringify(ledger));
  } catch {
    // The in-memory ledger still counts for this server instance.
  }
}

export function stripeSecret(): string | undefined {
  return env("STRIPE_SECRET_KEY");
}

export function priceIdFor(plan: "month" | "year" | "pitch"): string | undefined {
  if (plan === "month") return env("STRIPE_PRICE_PLUS_MONTHLY");
  if (plan === "year") return env("STRIPE_PRICE_PLUS_ANNUAL");
  return env("STRIPE_PRICE_PITCH");
}

const PRICE_CACHE: Partial<Record<"month" | "year" | "pitch", string>> = {};

const PRICE_LOOKUP = {
  month: "smash_plus_monthly",
  year: "smash_plus_annual",
  pitch: "smash_extra_pitch",
} as const;

export async function resolvePriceId(plan: "month" | "year" | "pitch"): Promise<string> {
  const configured = priceIdFor(plan);
  if (configured) return configured;
  const cached = PRICE_CACHE[plan];
  if (cached) return cached;
  const lookup = PRICE_LOOKUP[plan];
  const existing = await stripeRequest<{ data?: { id?: string }[] }>(
    `prices?lookup_keys[]=${lookup}&active=true&limit=1`,
    undefined,
    "GET",
  );
  const found = existing.data?.[0]?.id;
  if (found) {
    PRICE_CACHE[plan] = found;
    return found;
  }
  const productName = plan === "pitch" ? "Smash Collab Extra Pitch" : "Smash Collab Plus";
  const product = await stripeRequest<{ id: string }>(
    "products",
    new URLSearchParams({ name: productName }),
  );
  const params = new URLSearchParams({
    product: product.id,
    currency: "usd",
    lookup_key: lookup,
    "unit_amount": plan === "month" ? "999" : plan === "year" ? "10789" : "99",
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

export async function stripeRequest<T>(path: string, params?: URLSearchParams, method = "POST"): Promise<T> {
  const key = stripeSecret();
  if (!key) throw new Error("Stripe is not configured.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params,
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Stripe request failed.");
  }
  return data;
}

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

async function ensureTables() {
  const sql = await getSql();
  await sql.query(
    "create table if not exists billing_accounts (channel_id text primary key, status text not null, plus_until bigint, pitches_purchased integer not null default 0, stripe_customer_id text, stripe_subscription_id text, updated_at bigint not null)",
  );
  await sql.query(
    "create table if not exists stripe_sessions (session_id text primary key, channel_id text not null, created_at bigint not null)",
  );
  return sql;
}

function accountFromRow(row: {
  channel_id: string;
  status: string;
  plus_until: number | null;
  pitches_purchased: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}): BillingAccount {
  return {
    channelId: row.channel_id,
    status: row.status === "plus" ? "plus" : "free",
    plusUntil: row.plus_until == null ? null : Number(row.plus_until),
    pitchesPurchased: Number(row.pitches_purchased) || 0,
    customerId: row.stripe_customer_id,
    subscriptionId: row.stripe_subscription_id,
  };
}

async function readAccount(channelId: string): Promise<BillingAccount | null> {
  const cached = readLedger().accounts[channelId];
  try {
    const sql = await ensureTables();
    const rows = await sql.query<{
      channel_id: string;
      status: string;
      plus_until: number | null;
      pitches_purchased: number;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }>("select channel_id, status, plus_until, pitches_purchased, stripe_customer_id, stripe_subscription_id from billing_accounts where channel_id = $1", [
      channelId,
    ]);
    if (rows[0]) return accountFromRow(rows[0]);
  } catch {
    // Fall back to the file ledger.
  }
  return cached ?? null;
}

async function writeAccount(account: BillingAccount) {
  const ledger = readLedger();
  ledger.accounts[account.channelId] = account;
  writeLedger(ledger);
  try {
    const sql = await ensureTables();
    await sql.query(
      "insert into billing_accounts (channel_id, status, plus_until, pitches_purchased, stripe_customer_id, stripe_subscription_id, updated_at) values ($1, $2, $3, $4, $5, $6, $7) on conflict (channel_id) do update set status = excluded.status, plus_until = excluded.plus_until, pitches_purchased = excluded.pitches_purchased, stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id, updated_at = excluded.updated_at",
      [
        account.channelId,
        account.status,
        account.plusUntil,
        account.pitchesPurchased,
        account.customerId,
        account.subscriptionId,
        Date.now(),
      ],
    );
  } catch {
    // The file ledger already has the account.
  }
}

async function rememberSession(sessionId: string, channelId: string): Promise<boolean> {
  const ledger = readLedger();
  if (ledger.sessions.includes(sessionId)) return false;
  ledger.sessions.push(sessionId);
  writeLedger(ledger);
  try {
    const sql = await ensureTables();
    const existing = await sql.query<{ session_id: string }>(
      "select session_id from stripe_sessions where session_id = $1",
      [sessionId],
    );
    if (existing.length > 0) return false;
    await sql.query("insert into stripe_sessions (session_id, channel_id, created_at) values ($1, $2, $3)", [
      sessionId,
      channelId,
      Date.now(),
    ]);
  } catch {
    // The file ledger already recorded the session.
  }
  return true;
}

export async function billingStatus(channelId: string): Promise<BillingAccount> {
  return (
    (await readAccount(channelId)) ?? {
      channelId,
      status: "free",
      plusUntil: null,
      pitchesPurchased: 0,
      customerId: null,
      subscriptionId: null,
    }
  );
}

export async function grantPlus(
  channelId: string,
  plusUntil: number,
  customerId: string | null,
  subscriptionId: string | null,
): Promise<BillingAccount> {
  const current = await billingStatus(channelId);
  const account: BillingAccount = {
    ...current,
    status: "plus",
    plusUntil: Math.max(current.plusUntil ?? 0, plusUntil),
    customerId: customerId ?? current.customerId,
    subscriptionId: subscriptionId ?? current.subscriptionId,
  };
  await writeAccount(account);
  return account;
}

export async function revokePlus(channelId: string): Promise<BillingAccount> {
  const current = await billingStatus(channelId);
  const account: BillingAccount = {
    ...current,
    status: "free",
    plusUntil: Date.now(),
    subscriptionId: null,
  };
  await writeAccount(account);
  return account;
}

export async function grantPitch(channelId: string, sessionId: string, customerId: string | null): Promise<BillingAccount & { applied: boolean }> {
  const fresh = await rememberSession(sessionId, channelId);
  const current = await billingStatus(channelId);
  if (!fresh) return { ...current, applied: false };
  const account: BillingAccount = {
    ...current,
    pitchesPurchased: current.pitchesPurchased + 1,
    customerId: customerId ?? current.customerId,
  };
  await writeAccount(account);
  return { ...account, applied: true };
}

type StripeSession = {
  id: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string; current_period_end?: number } | null;
  metadata?: Record<string, string>;
};

function customerIdOf(value: StripeSession["customer"]): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export async function applyCheckoutSession(session: StripeSession): Promise<BillingAccount & { applied: boolean; kind: "plus" | "pitch" | null }> {
  const channelId = session.metadata?.channelId?.trim();
  const kind = session.metadata?.kind === "pitch" ? "pitch" : session.metadata?.kind === "plus" ? "plus" : null;
  if (!channelId || !kind || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    const empty = await billingStatus(channelId || "unknown");
    return { ...empty, applied: false, kind };
  }
  const customerId = customerIdOf(session.customer);
  if (kind === "pitch") {
    const account = await grantPitch(channelId, session.id, customerId);
    return { ...account, kind };
  }
  let plusUntil = Date.now() + (session.metadata?.plan === "year" ? 366 : 32) * 24 * 60 * 60 * 1000;
  let subscriptionId: string | null = null;
  const subscription = session.subscription;
  if (typeof subscription === "string") {
    subscriptionId = subscription;
    try {
      const retrieved = await stripeRequest<{ current_period_end?: number }>(`subscriptions/${subscription}`, undefined, "GET");
      if (typeof retrieved.current_period_end === "number") plusUntil = retrieved.current_period_end * 1000;
    } catch {
      // Keep the fallback period if Stripe does not return the subscription.
    }
  } else if (subscription && typeof subscription.current_period_end === "number") {
    subscriptionId = subscription.id ?? null;
    plusUntil = subscription.current_period_end * 1000;
  }
  const fresh = await rememberSession(session.id, channelId);
  const account = await grantPlus(channelId, plusUntil, customerId, subscriptionId);
  return { ...account, applied: fresh, kind };
}
