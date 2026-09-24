import { readFileSync, writeFileSync } from "node:fs";
import { getSql } from "@/lib/db";
import { REFERRAL_PLUS_MS, referralCode } from "@/lib/referrals";

const FILE = "/tmp/smash-referrals.json";

type Claim = { code: string; refereeId: string; at: number };
type Ledger = { claims: Claim[]; rewards: Record<string, number> };

const memory = globalThis as typeof globalThis & { __smashReferrals?: Ledger };

function emptyLedger(): Ledger {
  return { claims: [], rewards: {} };
}

function readLedger(): Ledger {
  if (memory.__smashReferrals) return memory.__smashReferrals;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Ledger>;
    const rewards: Record<string, number> = {};
    if (parsed.rewards && typeof parsed.rewards === "object") {
      for (const [code, until] of Object.entries(parsed.rewards)) {
        if (typeof until === "number" && Number.isFinite(until)) rewards[code] = until;
      }
    }
    memory.__smashReferrals = {
      claims: Array.isArray(parsed.claims) ? parsed.claims.filter(isClaim) : [],
      rewards,
    };
  } catch {
    memory.__smashReferrals = emptyLedger();
  }
  return memory.__smashReferrals;
}

function writeLedger(ledger: Ledger) {
  memory.__smashReferrals = ledger;
  try {
    writeFileSync(FILE, JSON.stringify(ledger));
  } catch {
    // The in-memory ledger still counts for this server instance.
  }
}

function isClaim(value: unknown): value is Claim {
  if (!value || typeof value !== "object") return false;
  const claim = value as Claim;
  return typeof claim.code === "string" && typeof claim.refereeId === "string" && typeof claim.at === "number";
}

function extendPlus(current: number | undefined, now = Date.now()): number {
  const base = typeof current === "number" && current > now ? current : now;
  return base + REFERRAL_PLUS_MS;
}

async function ensureTables() {
  const sql = await getSql();
  await sql.query(
    "create table if not exists referral_claims (referee_id text primary key, referrer_code text not null, created_at bigint not null)",
  );
  await sql.query(
    "create table if not exists referral_rewards (referrer_code text primary key, plus_until bigint not null)",
  );
  return sql;
}

async function sqlClaims(): Promise<Claim[]> {
  try {
    const sql = await ensureTables();
    const rows = await sql.query<{ referee_id: string; referrer_code: string; created_at: number }>(
      "select referee_id, referrer_code, created_at from referral_claims",
    );
    return rows.map((row) => ({
      code: row.referrer_code,
      refereeId: row.referee_id,
      at: Number(row.created_at) || Date.now(),
    }));
  } catch {
    return [];
  }
}

async function sqlRewards(): Promise<Record<string, number>> {
  try {
    const sql = await ensureTables();
    const rows = await sql.query<{ referrer_code: string; plus_until: number }>(
      "select referrer_code, plus_until from referral_rewards",
    );
    const rewards: Record<string, number> = {};
    for (const row of rows) {
      if (typeof row.referrer_code === "string" && typeof row.plus_until === "number") {
        rewards[row.referrer_code] = Number(row.plus_until);
      }
    }
    return rewards;
  } catch {
    return {};
  }
}

function mergeClaims(left: Claim[], right: Claim[]): Claim[] {
  const byReferee = new Map<string, Claim>();
  for (const claim of [...left, ...right]) {
    if (!byReferee.has(claim.refereeId)) byReferee.set(claim.refereeId, claim);
  }
  return [...byReferee.values()];
}

function mergeRewards(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  const rewards = { ...left };
  for (const [code, until] of Object.entries(right)) {
    rewards[code] = Math.max(rewards[code] ?? 0, until);
  }
  return rewards;
}

async function loadLedger(): Promise<Ledger> {
  const file = readLedger();
  const ledger = {
    claims: mergeClaims(file.claims, await sqlClaims()),
    rewards: mergeRewards(file.rewards, await sqlRewards()),
  };
  writeLedger(ledger);
  return ledger;
}

async function saveReward(code: string, plusUntil: number) {
  try {
    const sql = await ensureTables();
    await sql.query(
      "insert into referral_rewards (referrer_code, plus_until) values ($1, $2) on conflict (referrer_code) do update set plus_until = excluded.plus_until",
      [code, plusUntil],
    );
  } catch {
    // The file ledger already has the reward.
  }
}

export async function referralStatus(rawCode: string): Promise<{ invites: number; plusUntil: number }> {
  const code = referralCode(rawCode);
  if (!code) return { invites: 0, plusUntil: 0 };
  const ledger = await loadLedger();
  const invites = ledger.claims.filter((claim) => claim.code === code).length;
  return { invites, plusUntil: ledger.rewards[code] ?? 0 };
}

export async function claimReferral(
  rawCode: string,
  rawRefereeId: string,
): Promise<{ invites: number; plusUntil: number; refereePlusUntil: number; already: boolean }> {
  const code = referralCode(rawCode);
  const refereeId = rawRefereeId.trim().slice(0, 80);
  const now = Date.now();
  if (!code || !refereeId) {
    return { invites: 0, plusUntil: 0, refereePlusUntil: 0, already: false };
  }
  const ledger = await loadLedger();
  const existing = ledger.claims.find((claim) => claim.refereeId === refereeId);
  if (existing) {
    const invites = ledger.claims.filter((claim) => claim.code === existing.code).length;
    return {
      invites,
      plusUntil: ledger.rewards[existing.code] ?? 0,
      refereePlusUntil: 0,
      already: true,
    };
  }
  const plusUntil = extendPlus(ledger.rewards[code], now);
  const next: Ledger = {
    claims: [...ledger.claims, { code, refereeId, at: now }],
    rewards: { ...ledger.rewards, [code]: plusUntil },
  };
  writeLedger(next);
  try {
    const sql = await ensureTables();
    await sql.query(
      "insert into referral_claims (referee_id, referrer_code, created_at) values ($1, $2, $3) on conflict (referee_id) do nothing",
      [refereeId, code, now],
    );
  } catch {
    // The file ledger already has the claim.
  }
  await saveReward(code, plusUntil);
  const invites = next.claims.filter((claim) => claim.code === code).length;
  return {
    invites,
    plusUntil,
    refereePlusUntil: now + REFERRAL_PLUS_MS,
    already: false,
  };
}