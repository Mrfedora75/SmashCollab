import { SignJWT, jwtVerify } from "jose";
import {
  buildCookie,
  clearCookie,
  getYoutubeSigningKey,
  parseCookieHeader,
} from "./session";

export const PLUS_COOKIE = "matchcut_plus";
export const YT_ACCOUNT_COOKIE = "yt_account";

/** 30 days — signed session identity used for Plus grant/restore. */
export const YT_ACCOUNT_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export type PlusEntitlement = {
  channelId: string;
  premiumUntil: number;
  source?: string;
};

export type YtAccount = {
  channelId: string;
};

function secondsUntil(msEpoch: number): number {
  return Math.max(1, Math.ceil((msEpoch - Date.now()) / 1000));
}

export async function signPlusEntitlement(
  entitlement: PlusEntitlement,
): Promise<string> {
  const expSeconds = secondsUntil(entitlement.premiumUntil);
  return new SignJWT({
    channelId: entitlement.channelId,
    premiumUntil: entitlement.premiumUntil,
    source: entitlement.source ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expSeconds}s`)
    .sign(getYoutubeSigningKey());
}

export async function readPlusEntitlement(
  token: string | undefined,
): Promise<PlusEntitlement | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getYoutubeSigningKey());
    const channelId = typeof payload.channelId === "string" ? payload.channelId : "";
    const premiumUntil =
      typeof payload.premiumUntil === "number"
        ? payload.premiumUntil
        : Number(payload.premiumUntil);
    const source =
      typeof payload.source === "string" && payload.source.length > 0
        ? payload.source
        : undefined;
    if (!channelId || !Number.isFinite(premiumUntil) || premiumUntil <= Date.now()) {
      return null;
    }
    return { channelId, premiumUntil: Math.floor(premiumUntil), source };
  } catch {
    return null;
  }
}

export function buildPlusCookie(
  request: Request,
  token: string,
  premiumUntil: number,
): string {
  return buildCookie(request, PLUS_COOKIE, token, secondsUntil(premiumUntil));
}

export function clearPlusCookie(request: Request): string {
  return clearCookie(request, PLUS_COOKIE);
}

export async function signYtAccount(channelId: string): Promise<string> {
  return new SignJWT({ channelId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${YT_ACCOUNT_MAX_AGE_SEC}s`)
    .sign(getYoutubeSigningKey());
}

export async function readYtAccount(
  token: string | undefined,
): Promise<YtAccount | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getYoutubeSigningKey());
    const channelId = typeof payload.channelId === "string" ? payload.channelId : "";
    if (!channelId) return null;
    return { channelId };
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

export async function plusForChannel(
  request: Request,
  channelId: string,
): Promise<PlusEntitlement | null> {
  const cookies = parseCookieHeader(request);
  const plus = await readPlusEntitlement(cookies[PLUS_COOKIE]);
  if (!plus || plus.channelId !== channelId) return null;
  return plus;
}
