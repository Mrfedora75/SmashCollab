export const PENDING_REF_KEY = "matchcut-pending-ref";
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
}

/** Claim a pending invite as the verified creator in this session. Returns the invite Plus end time. */
export async function claimPendingReferral(channel: string): Promise<number | null> {
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
      body: JSON.stringify({ code }),
    });
    if (res.status === 401 || res.status >= 500) return null; // try again next sign-in
    localStorage.setItem(REF_CLAIMED_KEY, "1");
    localStorage.removeItem(PENDING_REF_KEY);
    if (!res.ok) return null;
    const data = (await res.json()) as { refereePlusUntil?: number; already?: boolean };
    return typeof data.refereePlusUntil === "number" && data.refereePlusUntil > 0 && data.already !== true
      ? data.refereePlusUntil
      : null;
  } catch {
    return null;
  }
}

/** Invite status for the signed-in creator (the server derives the code from the verified session). */
export async function fetchReferralStatus(): Promise<ReferralStatus | null> {
  try {
    const res = await fetch("/api/referrals", {
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
