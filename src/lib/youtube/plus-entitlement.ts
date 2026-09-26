import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env.server";
import { referralCode } from "@/lib/referrals";
import { readReferralReward } from "@/lib/referrals.server";
import { readEntitlement } from "@/lib/stripe-billing.server";
import { isStorageConfigured } from "@/lib/server/firestore.server";
import {
  buildCookie,
  clearCookie,
  getPlusCookieKeys,
  getYoutubeSigningKey,
  parseCookieHeader,
  readVerifiedChannel,
  YT_CHANNEL_COOKIE,
} from "./session";

/** Cookie name kept for compatibility with existing sessions. */
export const PLUS_COOKIE = "matchcut_plus";
export const YT_ACCOUNT_COOKIE = "yt_account";

/** 30 days — signed session identity used for billing and Plus restore. */
export const YT_ACCOUNT_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** Only entitlements that came from durable storage are ever put in the cookie. */
const TRUSTED_SOURCES = new Set(["stripe", "referral", "durable", "comp"]);

export type PlusEntitlement = {
  channelId: string;
  premiumUntil: number;
  source?: string;
};

export type YtAccount = {
  channelId: string;
  /** YouTube handle (e.g. "@name"), used for invite codes. */
  channel: string | null;
  /** Google-verified email from the OAuth grant (null for older sessions). */
  email: string | null;
};

function secondsUntil(msEpoch: number): number {
  return Math.max(1, Math.ceil((msEpoch - Date.now()) / 1000));
}

export async function signPlusEntitlement(entitlement: PlusEntitlement): Promise<string> {
  const [key] = getPlusCookieKeys();
  return new SignJWT({
    channelId: entitlement.channelId,
    premiumUntil: entitlement.premiumUntil,
    source: entitlement.source ?? "durable",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${secondsUntil(entitlement.premiumUntil)}s`)
    .sign(key);
}

export async function readPlusEntitlement(token: string | undefined): Promise<PlusEntitlement | null> {
  if (!token) return null;
  let keys: Uint8Array[];
  try {
    keys = getPlusCookieKeys();
  } catch {
    return null;
  }
  for (const key of keys) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      const channelId = typeof payload.channelId === "string" ? payload.channelId : "";
      const premiumUntil = typeof payload.premiumUntil === "number" ? payload.premiumUntil : Number(payload.premiumUntil);
      const source = typeof payload.source === "string" ? payload.source : "";
      // Cookies minted by the old free /api/plus/grant route carry no trusted source.
      if (!channelId || !TRUSTED_SOURCES.has(source)) return null;
      if (!Number.isFinite(premiumUntil) || premiumUntil <= Date.now()) return null;
      return { channelId, premiumUntil: Math.floor(premiumUntil), source };
    } catch {
      // try the next key
    }
  }
  return null;
}

export function buildPlusCookie(request: Request, token: string, premiumUntil: number): string {
  return buildCookie(request, PLUS_COOKIE, token, secondsUntil(premiumUntil));
}

export function clearPlusCookie(request: Request): string {
  return clearCookie(request, PLUS_COOKIE);
}

export async function signYtAccount(channelId: string, channel: string | null, email: string | null): Promise<string> {
  return new SignJWT({ channelId, channel, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${YT_ACCOUNT_MAX_AGE_SEC}s`)
    .sign(getYoutubeSigningKey());
}

export async function readYtAccount(token: string | undefined): Promise<YtAccount | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getYoutubeSigningKey(), { algorithms: ["HS256"] });
    const channelId = typeof payload.channelId === "string" ? payload.channelId : "";
    if (!channelId) return null;
    const channel = typeof payload.channel === "string" && payload.channel ? payload.channel : null;
    const email = typeof payload.email === "string" && payload.email ? payload.email : null;
    return { channelId, channel, email };
  } catch {
    return null;
  }
}

export function buildYtAccountCookie(request: Request, token: string): string {
  return buildCookie(request, YT_ACCOUNT_COOKIE, token, YT_ACCOUNT_MAX_AGE_SEC);
}

export function clearYtAccountCookie(request: Request): string {
  return clearCookie(request, YT_ACCOUNT_COOKIE);
}

/** The verified YouTube identity for this request, from signed cookies only. */
export async function requestAccount(request: Request): Promise<YtAccount | null> {
  const cookies = parseCookieHeader(request);
  const account = await readYtAccount(cookies[YT_ACCOUNT_COOKIE]);
  if (account) return account;
  const verified = await readVerifiedChannel(cookies[YT_CHANNEL_COOKIE]);
  return verified ? { channelId: verified.channelId, channel: verified.channel, email: verified.email } : null;
}

export type PlusStatus = {
  premium: boolean;
  premiumUntil: number | null;
  pitchCredits: number;
  source: "stripe" | "referral" | "comp" | null;
  storage: "ok" | "unconfigured" | "error";
};

/**
 * Plus for a channel from durable storage (paid Stripe time, invite time, and
 * invite rewards). If storage is temporarily unreachable, a previously issued
 * signed cookie for the same channel is honored until it expires.
 */
function listEnv(name: string): string[] {
  return (env(name) ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Tester comp: free Plus for allowlisted testers only. Checked against the
 * signed server session (verified Google email / verified YouTube channel ID),
 * never against anything the browser sends.
 *   PLUS_COMP_EMAILS       comma-separated Google emails
 *   PLUS_COMP_CHANNEL_IDS  comma-separated YouTube channel IDs (UC...)
 */
export function isCompAccount(account: YtAccount): boolean {
  const emails = listEnv("PLUS_COMP_EMAILS");
  const channels = listEnv("PLUS_COMP_CHANNEL_IDS");
  if (account.email && emails.includes(account.email.toLowerCase())) return true;
  return channels.includes(account.channelId.toLowerCase());
}

/** Comp Plus is re-checked on every status read, so removing someone from the list ends it within this window. */
const COMP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function resolvePlus(request: Request, account: YtAccount): Promise<PlusStatus> {
  // resolveStoredPlus already applies comp; this also covers the unconfigured / cookie-fallback paths.
  return withComp(account, await resolvePaidPlus(request, account));
}

/**
 * Plus for a channel straight from durable storage (paid Stripe time, invite
 * time, invite rewards, tester comp). Throws if storage is unreachable. Used
 * by server code that has no browser session (webhooks, pitch API).
 */
export async function resolveStoredPlus(account: YtAccount): Promise<PlusStatus> {
  const ent = await readEntitlement(account.channelId);
  const code = account.channel ? referralCode(account.channel) : "";
  const reward = code ? await readReferralReward(code) : 0;
  const referralUntil = Math.max(ent.referralPlusUntil, reward);
  const until = Math.max(ent.plusUntil, referralUntil);
  const premium = until > Date.now();
  const status: PlusStatus = {
    premium,
    premiumUntil: premium ? until : null,
    pitchCredits: ent.pitchCredits,
    source: premium ? (ent.plusUntil >= referralUntil ? "stripe" : "referral") : null,
    storage: "ok",
  };
  return withComp(account, status);
}

function withComp(account: YtAccount, status: PlusStatus): PlusStatus {
  if (!isCompAccount(account)) return status;
  const compUntil = Date.now() + COMP_WINDOW_MS;
  if (!status.premiumUntil || status.premiumUntil < compUntil) {
    return { ...status, premium: true, premiumUntil: compUntil, source: "comp" };
  }
  return status;
}

async function resolvePaidPlus(request: Request, account: YtAccount): Promise<PlusStatus> {
  if (!isStorageConfigured()) {
    return { premium: false, premiumUntil: null, pitchCredits: 0, source: null, storage: "unconfigured" };
  }
  try {
    return await resolveStoredPlus(account);
  } catch {
    const cookies = parseCookieHeader(request);
    const cached = await readPlusEntitlement(cookies[PLUS_COOKIE]);
    const ok = cached != null && cached.channelId === account.channelId;
    return {
      premium: ok,
      premiumUntil: ok ? cached.premiumUntil : null,
      pitchCredits: 0,
      source: ok ? (cached.source === "referral" ? "referral" : cached.source === "comp" ? "comp" : "stripe") : null,
      storage: "error",
    };
  }
}

/** Set-Cookie value that mirrors the durable status into the signed Plus cookie. */
export async function plusCookieFor(request: Request, account: YtAccount, status: PlusStatus): Promise<string | null> {
  if (status.storage === "error") return null;
  if (!status.premium || !status.premiumUntil) return clearPlusCookie(request);
  const token = await signPlusEntitlement({
    channelId: account.channelId,
    premiumUntil: status.premiumUntil,
    source: status.source ?? "durable",
  });
  return buildPlusCookie(request, token, status.premiumUntil);
}
