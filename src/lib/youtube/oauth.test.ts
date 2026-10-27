import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YOUTUBE_SCOPES } from "@/lib/youtube/config";
import {
  buildGoogleAuthUrl,
  fetchVerifiedChannel,
  isRetryableYouTubeFailure,
  YOUTUBE_CHANNEL_RETRY_DELAYS_MS,
  type ChannelFetchDeps,
} from "@/lib/youtube/oauth";

const TOKEN = "ya29.access-token-secret";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function channelItem(statistics?: Record<string, unknown> | null) {
  const item: Record<string, unknown> = {
    id: "UCwarren",
    snippet: {
      title: "Warren Area Society of Paranormal",
      customUrl: "@warrenareasocietyofparanormal",
      thumbnails: { high: { url: "https://yt3.ggpht.com/avatar.jpg" } },
    },
  };
  if (statistics !== null) {
    item.statistics = statistics ?? { subscriberCount: "1100", viewCount: "50000", videoCount: "40" };
  }
  return item;
}

function channelOk(statistics?: Record<string, unknown> | null): Response {
  return json(200, { items: [channelItem(statistics)] });
}

function ytError(status: number, reason: string): Response {
  return json(status, {
    error: { code: status, message: reason, errors: [{ reason, domain: "youtube.header", message: reason }] },
  });
}

function installFetch(pages: Response[]) {
  const calls: string[] = [];
  const sleep = vi.fn(async (_ms: number) => {});
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
    const authorization = new Headers(init?.headers).get("authorization");
    calls.push(`${url.origin}${url.pathname}?${url.searchParams.toString()}`);
    expect(authorization).toBe(`Bearer ${TOKEN}`);
    expect(url.searchParams.get("access_token")).toBeNull();
    if (url.hostname === "openidconnect.googleapis.com") {
      return json(200, { name: "Warren", email: "Owner@Example.com", email_verified: true });
    }
    const next = pages.shift();
    if (!next) throw new Error(`unexpected YouTube call ${url}`);
    expect(url.searchParams.get("mine")).toBe("true");
    return next;
  });
  const deps: ChannelFetchDeps = { fetch: fetchMock, sleep };
  return {
    calls,
    sleep,
    deps,
    fetchMock,
    youtubeCalls: () => calls.filter((url) => url.includes("youtube/v3/channels")),
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchVerifiedChannel", () => {
  it("requests snippet and statistics and returns the handle and count", async () => {
    const { deps, youtubeCalls } = installFetch([channelOk()]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    expect("reason" in channel).toBe(false);
    if ("reason" in channel) return;
    expect(channel.channel).toBe("@warrenareasocietyofparanormal");
    expect(channel.subscribers).toBe(1100);
    expect(channel.subscribersKnown).toBe(true);
    expect(channel.subscribersHidden).toBe(false);
    expect(channel.avgViews).toBe(1250);
    expect(channel.email).toBe("owner@example.com");
    const first = new URL(youtubeCalls()[0]);
    expect(first.searchParams.get("part")).toBe("snippet,statistics");
    expect(first.searchParams.get("mine")).toBe("true");
    expect(youtubeCalls()).toHaveLength(1);
  });

  it("retries a 401 from a just-issued token and then succeeds", async () => {
    const { deps, sleep, youtubeCalls } = installFetch([ytError(401, "authError"), channelOk()]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    expect("reason" in channel).toBe(false);
    if ("reason" in channel) return;
    expect(channel.subscribers).toBe(1100);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([YOUTUBE_CHANNEL_RETRY_DELAYS_MS[0]]);
    expect(youtubeCalls()).toHaveLength(2);
  });

  it("retries an empty mine=true list before treating it as no channel", async () => {
    const { deps, youtubeCalls } = installFetch([json(200, { items: [] }), channelOk()]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    expect("reason" in channel).toBe(false);
    expect(youtubeCalls()).toHaveLength(2);
  });

  it("does not call a real channel 'no channel' when YouTube says youtubeSignupRequired", async () => {
    const pages = Array.from({ length: 4 }, () => ytError(403, "youtubeSignupRequired"));
    const { deps, sleep } = installFetch(pages);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    expect(channel).toEqual({ reason: "api" });
    expect(sleep).toHaveBeenCalledTimes(YOUTUBE_CHANNEL_RETRY_DELAYS_MS.length);
  });

  it("reports no channel only after an empty list stays empty", async () => {
    const pages = Array.from({ length: 4 }, () => json(200, { items: [] }));
    const { deps } = installFetch(pages);
    expect(await fetchVerifiedChannel(TOKEN, deps)).toEqual({ reason: "no_channel" });
  });

  it("signs in when the subscriber count is hidden", async () => {
    const { deps } = installFetch([
      channelOk({ hiddenSubscriberCount: true, subscriberCount: "0", viewCount: "8000", videoCount: "4" }),
    ]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    expect("reason" in channel).toBe(false);
    if ("reason" in channel) return;
    expect(channel.channel).toBe("@warrenareasocietyofparanormal");
    expect(channel.subscribersHidden).toBe(true);
    expect(channel.subscribersKnown).toBe(false);
    expect(channel.subscribers).toBe(0);
    expect(channel.avgViews).toBe(2000);
    expect(channel.statisticsAvailable).toBe(true);
  });

  it("keeps a positive count the owner can see when the public count is hidden", async () => {
    const { deps } = installFetch([
      channelOk({ hiddenSubscriberCount: true, subscriberCount: "1100", viewCount: "10", videoCount: "2" }),
    ]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    if ("reason" in channel) throw new Error(channel.reason);
    expect(channel.subscribers).toBe(1100);
    expect(channel.subscribersKnown).toBe(true);
    expect(channel.subscribersHidden).toBe(true);
  });

  it("signs in when statistics are missing from the channel payload", async () => {
    const { deps } = installFetch([channelOk(null)]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    if ("reason" in channel) throw new Error(channel.reason);
    expect(channel.channel).toBe("@warrenareasocietyofparanormal");
    expect(channel.statisticsAvailable).toBe(false);
    expect(channel.subscribersKnown).toBe(false);
    expect(channel.subscribersHidden).toBe(false);
    expect(channel.subscribers).toBe(0);
  });

  it("treats a public subscriber count of zero as a real zero", async () => {
    const { deps } = installFetch([channelOk({ subscriberCount: "0", viewCount: "0", videoCount: "0" })]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    if ("reason" in channel) throw new Error(channel.reason);
    expect(channel.subscribers).toBe(0);
    expect(channel.subscribersKnown).toBe(true);
    expect(channel.subscribersHidden).toBe(false);
  });

  it("falls back to snippet when statistics are rejected and still signs in", async () => {
    const { deps, youtubeCalls } = installFetch([ytError(400, "invalidPart"), channelOk(null)]);
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    if ("reason" in channel) throw new Error(channel.reason);
    expect(channel.subscribersKnown).toBe(false);
    expect(channel.statisticsAvailable).toBe(false);
    const parts = youtubeCalls().map((url) => new URL(url).searchParams.get("part"));
    expect(parts).toEqual(["snippet,statistics", "snippet"]);
  });

  it("does not retry a permanent permission or quota failure", async () => {
    const { deps, sleep, youtubeCalls } = installFetch([ytError(403, "insufficientPermissions")]);
    expect(await fetchVerifiedChannel(TOKEN, deps)).toEqual({ reason: "api" });
    expect(sleep).not.toHaveBeenCalled();
    expect(youtubeCalls()).toHaveLength(1);

    const quota = installFetch([ytError(403, "quotaExceeded")]);
    expect(await fetchVerifiedChannel(TOKEN, quota.deps)).toEqual({ reason: "api" });
    expect(quota.youtubeCalls()).toHaveLength(1);
  });

  it("retries a network error and then reads the channel", async () => {
    const { deps, fetchMock } = installFetch([channelOk()]);
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("network down");
    });
    const channel = await fetchVerifiedChannel(TOKEN, deps);
    if ("reason" in channel) throw new Error(channel.reason);
    expect(channel.subscribers).toBe(1100);
  });
});

describe("buildGoogleAuthUrl", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it("requests an authorization code without a refresh token", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client";
    const request = new Request("https://smashcollab.com/api/youtube/start");
    const built = buildGoogleAuthUrl(request, "state-token");
    expect(built).toBeTruthy();
    const url = new URL(built!);
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://smashcollab.com/api/youtube/callback");
    expect(url.searchParams.get("scope")).toBe(YOUTUBE_SCOPES);
    expect(url.searchParams.get("prompt")).toBe("consent select_account");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("access_type")).toBeNull();
    expect(url.searchParams.has("refresh_token")).toBe(false);
  });
});

describe("isRetryableYouTubeFailure", () => {
  it("retries propagation and rate-limit failures and not quota or missing scope", () => {
    expect(isRetryableYouTubeFailure(401, "authError")).toBe(true);
    expect(isRetryableYouTubeFailure(403, "youtubeSignupRequired")).toBe(true);
    expect(isRetryableYouTubeFailure(500, "backendError")).toBe(true);
    expect(isRetryableYouTubeFailure(429, "userRateLimitExceeded")).toBe(true);
    expect(isRetryableYouTubeFailure(403, "quotaExceeded")).toBe(false);
    expect(isRetryableYouTubeFailure(403, "insufficientPermissions")).toBe(false);
  });
});
