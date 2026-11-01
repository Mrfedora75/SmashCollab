import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/firestore.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/firestore.server")>()),
  isStorageConfigured: () => true,
}));
const { handleOwnerStatsApi, handleOwnerStatsPage, newYorkMidnight, tokenMatches } = await import("@/lib/server/owner-stats.server");

const TOKEN = "s3cret-owner-token";
const count = vi.fn(async (filter?: { field: string; sinceMs: number }) => (filter ? 2 : 10));
const api = (auth?: string) => handleOwnerStatsApi(new Request("http://x/api/owner/stats", auth ? { headers: { Authorization: auth } } : {}), count);
const page = (q = "") => handleOwnerStatsPage(new Request(`http://x/owner/stats${q}`), count);

beforeEach(() => {
  process.env.OWNER_STATS_TOKEN = TOKEN;
  count.mockClear();
});
afterEach(() => {
  delete process.env.OWNER_STATS_TOKEN;
});

describe("owner stats auth", () => {
  it("is disabled (404) when the env var is unset", async () => {
    delete process.env.OWNER_STATS_TOKEN;
    expect((await api(`Bearer ${TOKEN}`)).status).toBe(404);
    expect((await page(`?key=${TOKEN}`)).status).toBe(404);
    expect(count).not.toHaveBeenCalled();
  });
  it("rejects a missing token", async () => {
    expect((await api()).status).toBe(401);
    expect((await page()).status).toBe(401);
    expect(count).not.toHaveBeenCalled();
  });
  it("rejects a wrong token", async () => {
    expect((await api("Bearer nope")).status).toBe(401);
    expect((await page("?key=nope")).status).toBe(401);
    expect(tokenMatches(TOKEN + "x")).toBe(false);
  });
  it("returns counts only, no-store, for the right token", async () => {
    const res = await api(`Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ totalMembers: 10, signupsToday: 2, signupsLast24h: 2, signupsLast7d: 2 });
    const p = await page(`?key=${encodeURIComponent(TOKEN)}`);
    expect(p.status).toBe(200);
    expect(p.headers.get("x-robots-tag")).toContain("noindex");
    const text = await p.text();
    expect(text).toContain("Total members");
    expect(text).not.toContain(TOKEN);
  });
});

describe("newYorkMidnight", () => {
  it("finds midnight New York time (EST and EDT)", () => {
    expect(new Date(newYorkMidnight(Date.parse("2026-11-01T19:57:00Z"))).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(newYorkMidnight(Date.parse("2026-11-02T03:00:00Z"))).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(newYorkMidnight(Date.parse("2026-07-04T12:00:00Z"))).toISOString()).toBe("2026-07-04T04:00:00.000Z");
    expect(new Date(newYorkMidnight(Date.parse("2026-01-15T12:00:00Z"))).toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
});
