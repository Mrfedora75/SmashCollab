export const PENDING_REF_KEY = "matchcut-pending-ref";
export const REFEREE_ID_KEY = "matchcut-referee-id";
export const REF_CLAIMED_KEY = "matchcut-ref-claimed";
export const BONUS_DAILY_PER_INVITE = 2;

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
  return `https://smash-collab.vercel.app/?ref=${encodeURIComponent(code || "creator")}`;
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

export async function claimPendingReferral(channel: string, channelId?: string): Promise<void> {
  const code = localStorage.getItem(PENDING_REF_KEY);
  if (!code || localStorage.getItem(REF_CLAIMED_KEY) === "1") return;
  if (referralCode(channel) === code) {
    localStorage.removeItem(PENDING_REF_KEY);
    return;
  }
  try {
    const res = await fetch("/api/referrals", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ code, refereeId: refereeId(channelId) }),
    });
    if (!res.ok) return;
    localStorage.setItem(REF_CLAIMED_KEY, "1");
    localStorage.removeItem(PENDING_REF_KEY);
  } catch {
    // Keep the pending code so the next visit can retry.
  }
}

export async function fetchReferralStatus(channel: string): Promise<{ invites: number; bonusDaily: number } | null> {
  const code = referralCode(channel);
  if (!code) return null;
  try {
    const res = await fetch(`/api/referrals?code=${encodeURIComponent(code)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { invites?: number; bonusDaily?: number };
    return {
      invites: typeof data.invites === "number" ? data.invites : 0,
      bonusDaily: typeof data.bonusDaily === "number" ? data.bonusDaily : 0,
    };
  } catch {
    return null;
  }
}
