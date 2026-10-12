import { describe, expect, it, vi } from "vitest";
import { runAgeBackfill, type ProfileDoc } from "@/lib/server/backfill-age";

const pages: { docs: ProfileDoc[]; nextPageToken: string | null }[] = [
  { docs: [{ id: "a", data: { ageConfirmed: true } }, { id: "b", data: {} }], nextPageToken: "p2" },
  { docs: [{ id: "c", data: { ageConfirmed: false } }], nextPageToken: null },
];
const listPage = async (token: string | null) => pages[token ? 1 : 0];

describe("age backfill", () => {
  it("dry run (default) counts but never writes", async () => {
    const commit = vi.fn();
    const r = await runAgeBackfill({ apply: false, listPage, commit });
    expect(r).toMatchObject({ scanned: 3, wouldChange: 2, changed: 0, ids: ["b", "c"] });
    expect(commit).not.toHaveBeenCalled();
  });

  it("--apply writes ageConfirmed only to existing docs that lack it", async () => {
    const commit = vi.fn(async () => undefined);
    const r = await runAgeBackfill({ apply: true, listPage, commit });
    expect(r.changed).toBe(2);
    const writes = commit.mock.calls.flat(2) as { path: string; fields: Record<string, unknown>; precondition: string }[];
    expect(writes.map((w) => w.path)).toEqual(["users/b", "users/c"]);
    expect(writes.every((w) => w.fields.ageConfirmed === true && w.precondition === "exists")).toBe(true);
  });
});
