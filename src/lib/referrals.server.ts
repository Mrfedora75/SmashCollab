import { readFileSync, writeFileSync } from "node:fs";
import { getSql } from "@/lib/db";
import { BONUS_DAILY_PER_INVITE, referralCode } from "@/lib/referrals";

const FILE = "/tmp/smash-referrals.json";

type Claim = { code: string; refereeId: string; at: number };
type Ledger = { claims: Claim[] };

const memory = globalThis as typeof globalThis & { __smashReferrals?: Ledger };

function emptyLedger(): Ledger {
  return { claims: [] };
}

function readLedger(): Ledger {
  if (memory.__smashReferrals) return memory.__smashReferrals;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Ledger;
    memory.__smashReferrals = {
      claims: Array.isArray(parsed.claims) ? parsed.claims.filter(isClaim) : [],
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

async function ensureTable() {
  const sql = await getSql();
  await sql.query(
    "create table if not exists referral_claims (referee_id text primary key, referrer_code text not null, created_at bigint not null)",
  );
  return sql;
}

async function sqlClaims(): Promise<Claim[]> {
  try {
    const sql = await ensureTable();
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

function mergeClaims(left: Claim[], right: Claim[]): Claim[] {
  const byReferee = new Map<string, Claim>();
  for (const claim of [...left, ...right]) {
    if (!byReferee.has(claim.refereeId)) byReferee.set(claim.refereeId, claim);
  }
  return [...byReferee.values()];
}

async function allClaims(): Promise<Claim[]> {
  const merged = mergeClaims(readLedger().claims, await sqlClaims());
  writeLedger({ claims: merged });
  return merged;
}

export async function referralStatus(rawCode: string): Promise<{ invites: number; bonusDaily: number }> {
  const code = referralCode(rawCode);
  if (!code) return { invites: 0, bonusDaily: 0 };
  const invites = (await allClaims()).filter((claim) => claim.code === code).length;
  return { invites, bonusDaily: invites * BONUS_DAILY_PER_INVITE };
}

export async function claimReferral(rawCode: string, rawRefereeId: string): Promise<{ invites: number; bonusDaily: number; already: boolean }> {
  const code = referralCode(rawCode);
  const refereeId = rawRefereeId.trim().slice(0, 80);
  if (!code || !refereeId) {
    return { invites: 0, bonusDaily: 0, already: false };
  }
  const claims = await allClaims();
  const existing = claims.find((claim) => claim.refereeId === refereeId);
  if (existing) {
    const invites = claims.filter((claim) => claim.code === existing.code).length;
    return { invites, bonusDaily: invites * BONUS_DAILY_PER_INVITE, already: true };
  }
  const next = [...claims, { code, refereeId, at: Date.now() }];
  writeLedger({ claims: next });
  try {
    const sql = await ensureTable();
    await sql.query(
      "insert into referral_claims (referee_id, referrer_code, created_at) values ($1, $2, $3) on conflict (referee_id) do nothing",
      [refereeId, code, Date.now()],
    );
  } catch {
    // The file ledger already has the claim.
  }
  const invites = next.filter((claim) => claim.code === code).length;
  return { invites, bonusDaily: invites * BONUS_DAILY_PER_INVITE, already: false };
}
