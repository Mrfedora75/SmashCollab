/** Client helpers that read Smash Collab Plus from the server (read-only). */

/** Local cache of the last server-confirmed Plus end time. */
export const PLUS_LOCAL_KEY = "matchcut-plus";

export type ServerPlus = {
  premium: boolean;
  premiumUntil: number | null;
  pitchCredits: number;
  /** "ok" when the server read durable storage; otherwise the numbers are not authoritative. */
  storage: "ok" | "unconfigured" | "error" | "signed-out";
};

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

export function parseServerPlus(data: unknown): ServerPlus {
  const d = (data ?? {}) as Partial<ServerPlus> & { channelId?: string | null };
  const premiumUntil =
    d.premium === true && typeof d.premiumUntil === "number" && d.premiumUntil > Date.now() ? Math.floor(d.premiumUntil) : null;
  return {
    premium: premiumUntil != null,
    premiumUntil,
    pitchCredits: typeof d.pitchCredits === "number" && d.pitchCredits > 0 ? Math.floor(d.pitchCredits) : 0,
    storage: d.channelId === null ? "signed-out" : d.storage === "ok" || d.storage === "unconfigured" ? d.storage : "error",
  };
}

export async function fetchPlusFromServer(): Promise<ServerPlus | null> {
  try {
    const res = await fetch("/api/plus/status", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return parseServerPlus(await res.json());
  } catch {
    return null;
  }
}
