import type { Creator } from "@/data/creators";

export function formatCount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const text = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1);
    return `${text.replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    const text = thousands >= 10 ? thousands.toFixed(0) : thousands.toFixed(1);
    return `${text.replace(/\.0$/, "")}K`;
  }
  return String(value);
}

export function todayKey(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function defaultPitch(
  creator: Creator,
  me: { channel: string; subscribers: number; niches: string[] } | null,
): string {
  const first = creator.name.split(" ")[0] || creator.channel;
  const intro = me
    ? `I'm ${me.channel} (${formatCount(me.subscribers)}${me.niches.length ? `, ${me.niches.slice(0, 2).join(" & ").toLowerCase()}` : ""})`
    : "I found your channel on Smash Collab";
  return `Hey ${first} — ${intro}. I think our audiences would overlap well. Open to a collab this month?`;
}

export function fitLabel(fit: number): string {
  if (fit >= 80) return "Strong overlap";
  if (fit >= 60) return "Worth a pitch";
  return "Stretch collab";
}
