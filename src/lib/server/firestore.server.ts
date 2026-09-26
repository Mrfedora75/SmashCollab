/**
 * Durable server-side storage in Firestore, used for billing entitlements,
 * Stripe session idempotency, and referral rewards.
 *
 * Talks to the Firestore REST API with a Google service account (signed with
 * `jose`) instead of `firebase-admin`, so the Vercel function stays small and
 * there is no gRPC bundling. Service-account writes bypass Firestore security
 * rules; `firestore.rules` denies every client read/write on these server-only
 * collections.
 *
 * Needs env `FIREBASE_SERVICE_ACCOUNT`: the service-account JSON key for the
 * `smash-collab` Firebase project (raw JSON or base64-encoded JSON).
 */
import { SignJWT, importPKCS8 } from "jose";
import { env } from "@/lib/env.server";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Durable storage is not configured (FIREBASE_SERVICE_ACCOUNT is missing or invalid).");
    this.name = "StorageNotConfiguredError";
  }
}

let cachedAccount: ServiceAccount | null | undefined;

function readServiceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  const raw = env("FIREBASE_SERVICE_ACCOUNT");
  cachedAccount = null;
  if (!raw) return null;
  const candidates = [raw];
  if (!raw.startsWith("{")) {
    try {
      candidates.push(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      // not base64
    }
  }
  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text) as Partial<ServiceAccount>;
      if (parsed.client_email && parsed.private_key) {
        cachedAccount = {
          project_id: parsed.project_id || env("VITE_FIREBASE_PROJECT_ID") || "",
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
          token_uri: parsed.token_uri,
        };
        if (!cachedAccount.project_id) cachedAccount = null;
        break;
      }
    } catch {
      // try next candidate
    }
  }
  return cachedAccount;
}

export function isStorageConfigured(): boolean {
  return readServiceAccount() != null;
}

let tokenCache: { token: string; exp: number } | null = null;

async function accessToken(account: ServiceAccount): Promise<string> {
  if (tokenCache && tokenCache.exp - 60_000 > Date.now()) return tokenCache.token;
  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(tokenUri)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error(`Google token exchange failed (${res.status}).`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

function account(): ServiceAccount {
  const acct = readServiceAccount();
  if (!acct) throw new StorageNotConfiguredError();
  return acct;
}

function databaseRoot(acct: ServiceAccount): string {
  return `projects/${acct.project_id}/databases/(default)/documents`;
}

// ---- value encoding -------------------------------------------------------

export type Plain = string | number | boolean | null | Plain[] | { [key: string]: Plain };
type FsValue = Record<string, unknown>;

function encode(value: Plain): FsValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value) } };
}

function encodeFields(obj: Record<string, Plain>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = encode(v);
  return out;
}

function decode(value: FsValue | undefined): Plain {
  if (!value) return null;
  if ("stringValue" in value) return String(value.stringValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return Date.parse(String(value.timestampValue));
  if ("arrayValue" in value) {
    const values = ((value.arrayValue as { values?: FsValue[] })?.values ?? []).map(decode);
    return values;
  }
  if ("mapValue" in value) {
    return decodeFields((value.mapValue as { fields?: Record<string, FsValue> })?.fields ?? {});
  }
  return null;
}

function decodeFields(fields: Record<string, FsValue>): Record<string, Plain> {
  const out: Record<string, Plain> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v);
  return out;
}

/** Firestore document ids cannot contain "/" and must not be "." or "..". */
export function safeDocId(id: string): string {
  const cleaned = id.trim().replace(/\//g, "_").slice(0, 200);
  if (!cleaned || cleaned === "." || cleaned === "..") throw new Error("Invalid document id.");
  return cleaned;
}

// ---- operations -----------------------------------------------------------

export async function getDocument(path: string): Promise<Record<string, Plain> | null> {
  const acct = account();
  const token = await accessToken(acct);
  const res = await fetch(`https://firestore.googleapis.com/v1/${databaseRoot(acct)}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read failed (${res.status}).`);
  const data = (await res.json()) as { fields?: Record<string, FsValue> };
  return decodeFields(data.fields ?? {});
}

export type Write = {
  path: string;
  /** Only these fields are written (merge). */
  fields: Record<string, Plain>;
  /** Atomic server-side transforms applied after `fields`. */
  increment?: Record<string, number>;
  maximum?: Record<string, number>;
  /** "absent" = fail the whole commit if the document already exists. */
  precondition?: "absent";
};

export class PreconditionFailedError extends Error {
  constructor() {
    super("Firestore precondition failed.");
    this.name = "PreconditionFailedError";
  }
}

/** Atomic multi-document commit. Throws PreconditionFailedError on a failed precondition. */
export async function commit(writes: Write[]): Promise<void> {
  const acct = account();
  const token = await accessToken(acct);
  const root = databaseRoot(acct);
  const body = {
    writes: writes.map((write) => {
      const name = `${root}/${write.path}`;
      const updateTransforms: Record<string, unknown>[] = [];
      for (const [fieldPath, by] of Object.entries(write.increment ?? {})) {
        updateTransforms.push({ fieldPath, increment: encode(Math.trunc(by)) });
      }
      for (const [fieldPath, value] of Object.entries(write.maximum ?? {})) {
        updateTransforms.push({ fieldPath, maximum: encode(Math.trunc(value)) });
      }
      return {
        update: { name, fields: encodeFields(write.fields) },
        updateMask: { fieldPaths: Object.keys(write.fields).map((f) => `\`${f}\``) },
        ...(updateTransforms.length ? { updateTransforms } : {}),
        ...(write.precondition === "absent" ? { currentDocument: { exists: false } } : {}),
      };
    }),
  };
  const res = await fetch(`https://firestore.googleapis.com/v1/${root}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return;
  const err = (await res.json().catch(() => ({}))) as { error?: { status?: string } };
  if (res.status === 409 || err.error?.status === "ALREADY_EXISTS" || err.error?.status === "FAILED_PRECONDITION") {
    throw new PreconditionFailedError();
  }
  throw new Error(`Firestore write failed (${res.status}).`);
}
