/** Client helpers to sync Smash Collab Plus with the server cookie. */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
