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

export function defaultPitch(creator: Creator): string {
  const first = creator.name.split(" ")[0];
  return `Hey ${first} — I'm Northroom (96K, weeknight cooking). “${creator.videoTitle}” feels like a natural crossover. Open to a collab this month?`;
}

export function fitLabel(fit: number): string {
  if (fit >= 80) return "Strong overlap";
  if (fit >= 60) return "Worth a pitch";
  return "Stretch collab";
}
