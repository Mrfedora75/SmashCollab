/** Client helpers to sync Smash Collab Plus with the server cookie. */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Survives logout. `matchcut-v1` is wiped; this key is not. */
export const PLUS_LOCAL_KEY = "matchcut-plus";

export function readPlusLocal(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLUS_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { premiumUntil?: unknown };
    const until = typeof parsed.premiumUntil === "number" ? parsed.premiumUntil : Number.NaN;
    if (!Number.isFinite(until) || until <= Date.now()) {
      localStorage.removeItem(PLUS_LOCAL_KEY);
      return null;
    }
    return Math.floor(until);
  } catch {
    return null;
  }
}

export function writePlusLocal(premiumUntil: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PLUS_LOCAL_KEY, JSON.stringify({ premiumUntil: Math.floor(premiumUntil) }));
}

export function clearPlusLocal() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PLUS_LOCAL_KEY);
}

export async function fetchPlusFromServer(): Promise<number | null> {
  try {
    const res = await fetch("/api/plus/grant", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { premium?: boolean; premiumUntil?: number };
    if (data.premium === true && typeof data.premiumUntil === "number" && data.premiumUntil > Date.now()) {
      return Math.floor(data.premiumUntil);
    }
    return null;
  } catch {
    return null;
  }
}

export async function grantPlusOnServer(
  until: number | null | undefined,
  source?: string,
): Promise<{ ok: boolean; premiumUntil: number | null }> {
  const premiumUntil =
    typeof until === "number" && Number.isFinite(until) && until > Date.now()
      ? Math.floor(until)
      : Date.now() + THIRTY_DAYS_MS;
  try {
    const res = await fetch("/api/plus/grant", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ until: premiumUntil, source }),
    });
    if (!res.ok) return { ok: false, premiumUntil: null };
    const data = (await res.json()) as { premiumUntil?: number };
    return {
      ok: true,
      premiumUntil:
        typeof data.premiumUntil === "number" ? data.premiumUntil : premiumUntil,
    };
  } catch {
    return { ok: false, premiumUntil: null };
  }
}

export async function clearPlusOnServer(): Promise<boolean> {
  try {
    const res = await fetch("/api/plus/grant", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clear: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
