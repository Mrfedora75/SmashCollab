/**
 * One-time backfill: profiles created before the "I am 18 or older" checkbox (PR #10)
 * already passed the old 18+ age gate, so they are marked ageConfirmed: true.
 * Used by scripts/backfill-age-confirmed.ts. DRY RUN unless `apply` is true.
 */
import type { Plain, Write } from "@/lib/server/firestore.server";

export type ProfileDoc = { id: string; data: Record<string, Plain> };

/** A profile needs the backfill when it has no ageConfirmed: true. */
export function needsAgeBackfill(doc: ProfileDoc): boolean {
  return doc.data.ageConfirmed !== true;
}

export function backfillWrite(doc: ProfileDoc, now = Date.now()): Write {
  return {
    path: `users/${doc.id}`,
    fields: { ageConfirmed: true, ageConfirmedSource: "backfill-legacy-18-gate", ageBackfilledAt: now },
    // Never create a document that was deleted in the meantime.
    precondition: "exists",
  };
}

export async function runAgeBackfill(opts: {
  apply: boolean;
  listPage: (pageToken: string | null) => Promise<{ docs: ProfileDoc[]; nextPageToken: string | null }>;
  commit: (writes: Write[]) => Promise<void>;
  log?: (line: string) => void;
}): Promise<{ scanned: number; wouldChange: number; changed: number; ids: string[] }> {
  const log = opts.log ?? (() => undefined);
  let pageToken: string | null = null;
  let scanned = 0;
  let changed = 0;
  const ids: string[] = [];
  do {
    const page = await opts.listPage(pageToken);
    scanned += page.docs.length;
    const todo = page.docs.filter(needsAgeBackfill);
    ids.push(...todo.map((d) => d.id));
    if (opts.apply && todo.length > 0) {
      // Firestore commits take at most 500 writes.
      for (let i = 0; i < todo.length; i += 400) {
        await opts.commit(todo.slice(i, i + 400).map((d) => backfillWrite(d)));
        changed += Math.min(400, todo.length - i);
        log(`updated ${changed} so far`);
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { scanned, wouldChange: ids.length, changed, ids };
}
