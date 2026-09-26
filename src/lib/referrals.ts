export const PENDING_REF_KEY = "matchcut-pending-ref";
export const REFEREE_ID_KEY = "matchcut-referee-id";
export const REF_CLAIMED_KEY = "matchcut-ref-claimed";
export const REFERRAL_PLUS_MS = 14 * 24 * 60 * 60 * 1000;

export type ReferralStatus = {
  invites: number;
  plusUntil: number;
};

export function referralCode(channel: string): string {
  const slug = channel
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug;
}

export function referralLink(channel: string): string {
  const code = referralCode(channel);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://smashcollab.com";
  return `${origin}/?ref=${encodeURIComponent(code || "creator")}`;
}

export function captureReferralFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("ref");
  if (!raw) return;
  const code = referralCode(raw);
  params.delete("ref");
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
  if (!code) return;
  if (!localStorage.getItem("matchcut-profile")) {
    localStorage.setItem(PENDING_REF_KEY, code);
  }
  document.cookie = `matchcut_ref=${encodeURIComponent(code)}; Path=/; Max-Age=2592000; SameSite=Lax`;
}

function refereeId(channelId?: string): string {
  if (channelId && channelId.trim()) return channelId.trim();
  const existing = localStorage.getItem(REFEREE_ID_KEY);
  if (existing) return existing;
  const created = `local-${crypto.randomUUID()}`;
  localStorage.setItem(REFEREE_ID_KEY, created);
  return created;
}

export async function claimPendingReferral(channel: string, channelId?: string): Promise<number | null> {
  const code = localStorage.getItem(PENDING_REF_KEY);
  if (!code || localStorage.getItem(REF_CLAIMED_KEY) === "1") return null;
  if (referralCode(channel) === code) {
    localStorage.removeItem(PENDING_REF_KEY);
    return null;
  }
  try {
    const res = await fetch("/api/referrals", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ code, refereeId: refereeId(channelId) }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { refereePlusUntil?: number; already?: boolean };
    localStorage.setItem(REF_CLAIMED_KEY, "1");
    localStorage.removeItem(PENDING_REF_KEY);
    return typeof data.refereePlusUntil === "number" && data.already !== true ? data.refereePlusUntil : null;
  } catch {
    return null;
  }
}

export async function fetchReferralStatus(channel: string): Promise<ReferralStatus | null> {
  const code = referralCode(channel);
  if (!code) return null;
  try {
    const res = await fetch(`/api/referrals?code=${encodeURIComponent(code)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { invites?: number; plusUntil?: number };
    return {
      invites: typeof data.invites === "number" ? data.invites : 0,
      plusUntil: typeof data.plusUntil === "number" ? data.plusUntil : 0,
    };
  } catch {
    return null;
  }
}
