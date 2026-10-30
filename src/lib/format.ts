import type { Creator } from "@/data/creators";

export function subscriberCountLabel(input: {
  subscribers: number;
  subscribersKnown?: boolean;
  subscribersHidden?: boolean;
}): string {
  if (input.subscribersHidden && input.subscribersKnown === false) return "Subscribers hidden";
  if (input.subscribersKnown === false) return "Subscriber count unavailable";
  return `${formatCount(input.subscribers)} subscribers`;
}

export function subscriberFigure(input: {
  subscribers: number;
  subscribersKnown?: boolean;
  subscribersHidden?: boolean;
}): string {
  if (input.subscribersHidden && input.subscribersKnown === false) return "Hidden";
  if (input.subscribersKnown === false) return "Unavailable";
  return formatCount(input.subscribers);
}

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

export function defaultCollabNote(
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
  if (fit >= 60) return "Worth a collab";
  return "Stretch collab";
}

/** Invisible characters a phone keyboard or paste can leave in a bio. */
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;
/** One leading "open to", any case, with any spaces (including non-breaking) or : , - after it. */
const OPEN_TO_PREFIX = /^open[\s\u00A0]+to(?![a-z])[\s\u00A0:,\-–—]*/i;

/** Trim, drop invisible characters and squash runs of spaces. */
function tidy(value: string): string {
  return value.replace(INVISIBLE, "").replace(/[\s\u00A0]+/g, " ").trim();
}

/**
 * A bio with any repeated "Open to" at the start collapsed to a single one, so
 * "open to open to collabs." shows as "open to collabs.". Display only; stored data is untouched.
 */
export function collapseOpenTo(value: string): string {
  const text = tidy(value);
  const match = /^(?:open[\s\u00A0]+to(?![a-z])[\s\u00A0:,\-–—]*){2,}/i.exec(text);
  if (!match) return text;
  return `${text.slice(0, 7)} ${text.slice(match[0].length)}`.replace(/\s+/g, " ").trim();
}

/**
 * The "Open to …" line on a card. Bios often already start with "Open to" (and the
 * default is "Open to collabs"), so strip every leading "open to" (any case, any
 * spacing) and any trailing periods before adding ours, so it never doubles.
 */
export function openToLine(value: string | null | undefined): string {
  let rest = tidy(value ?? "");
  while (OPEN_TO_PREFIX.test(rest)) rest = rest.replace(OPEN_TO_PREFIX, "");
  rest = rest.replace(/[.\s…]+$/, "");
  return rest ? `Open to ${rest.toLowerCase()}.` : "Open to collabs.";
}
