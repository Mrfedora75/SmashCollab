/**
 * One-time backfill: mark existing users/{uid} profiles ageConfirmed: true (they already
 * passed the old 18+ age gate before the checkbox existed).
 *
 * Uses admin credentials: FIREBASE_SERVICE_ACCOUNT (service-account JSON, raw or base64),
 * the same variable the server uses. Service-account writes bypass Firestore rules.
 *
 *   DRY RUN (default, writes nothing):  npm run backfill:age
 *   Apply (writes):                     npm run backfill:age -- --apply
 */
import { commit, isStorageConfigured, listDocumentsPage } from "@/lib/server/firestore.server";
import { runAgeBackfill } from "@/lib/server/backfill-age";

const apply = process.argv.includes("--apply");

async function main() {
  if (!isStorageConfigured()) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not set (or invalid). Nothing done.");
    process.exit(2);
  }
  console.log(apply ? "APPLY MODE: profiles will be updated." : "DRY RUN: nothing will be written (pass --apply to write).");
  const result = await runAgeBackfill({
    apply,
    listPage: (token) => listDocumentsPage("users", 300, token),
    commit,
    log: (line) => console.log(line),
  });
  console.log(`Scanned ${result.scanned} profiles.`);
  console.log(`${apply ? "Updated" : "Would update"} ${apply ? result.changed : result.wouldChange} profiles missing ageConfirmed.`);
  if (!apply && result.ids.length) console.log(`First ids: ${result.ids.slice(0, 20).join(", ")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
