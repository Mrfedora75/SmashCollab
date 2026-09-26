/**
 * Verifies Firebase Auth ID tokens on the server (no firebase-admin needed).
 * Tokens are RS256 JWTs signed by Google's securetoken service account; we
 * check the signature against Google's published keys plus the issuer,
 * audience (Firebase project id), subject, and auth time.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { firebaseProjectId } from "@/lib/server/firestore.server";

const SECURETOKEN_JWKS =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let remoteKeys: JWTVerifyGetKey | null = null;
let keyOverride: JWTVerifyGetKey | null = null;

/** Tests only: verify against a local key set instead of Google's. */
export function setFirebaseKeysForTests(keys: JWTVerifyGetKey | null): void {
  keyOverride = keys;
}

function keys(): JWTVerifyGetKey {
  if (keyOverride) return keyOverride;
  if (!remoteKeys) remoteKeys = createRemoteJWKSet(new URL(SECURETOKEN_JWKS));
  return remoteKeys;
}

export type FirebaseIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export async function verifyFirebaseIdToken(token: string): Promise<FirebaseIdentity | null> {
  const projectId = firebaseProjectId();
  if (!token || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, keys(), {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid || uid.length > 128) return null;
    const authTime = typeof payload.auth_time === "number" ? payload.auth_time : Number.NaN;
    if (!Number.isFinite(authTime) || authTime > Date.now() / 1000 + 60) return null;
    const email = typeof payload.email === "string" && payload.email ? payload.email.trim().toLowerCase() : null;
    return { uid, email, emailVerified: payload.email_verified === true };
  } catch {
    return null;
  }
}

/** The Firebase user from `Authorization: Bearer <Firebase ID token>`, or null. */
export async function requestFirebaseUser(request: Request): Promise<FirebaseIdentity | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  return verifyFirebaseIdToken(match[1]);
}
