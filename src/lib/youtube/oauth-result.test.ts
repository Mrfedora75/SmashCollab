import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifiedChannelFields } from "@/lib/server/public-profile.server";
import { completeYouTubeGrant, redirectOAuthError, resumeYouTubeGrant } from "@/lib/youtube/oauth-result";
import { openPendingYouTubeAuth, readVerifiedChannel, YT_ACCESS_COOKIE, YT_CHANNEL_COOKIE } from "@/lib/youtube/session";
import type { VerifiedYouTubeChannel } from "@/lib/youtube/session";

const saved = { ...process.env };
const ACCESS = "ya29.access-token-secret";

const channel: VerifiedYouTubeChannel = {
  channelId: "UCwarren",
  displayName: "Warren Area Society of Paranormal",
  channel: "@warrenareasocietyofparanormal",
  subscribers: 1100,
  avgViews: 1250,
  avatar: null,
  email: "owner@example.com",
  subscribersKnown: true,
  subscribersHidden: false,
  statisticsAvailable: true,
};

function request(cookie = ""): Request {
  return new Request("https://smashcollab.com/api/youtube/callback", {
    headers: cookie ? { cookie } : {},
  });
}

function cookiePairs(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}

beforeEach(() => {
  process.env = { ...saved, GOOGLE_CLIENT_SECRET: "test-google-secret" };
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe("completeYouTubeGrant", () => {
  it("keeps an encrypted access token when channel stats fail, and not the raw token", async () => {
    const response = await completeYouTubeGrant(request(), "https://smashcollab.com/", {
      accessToken: ACCESS,
      idToken: "id-token-value",
    }, {
      fetchChannel: async () => ({ reason: "api" }),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://smashcollab.com/?yt=error&reason=api");
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).not.toContain(ACCESS);
    expect(cookies).toContain(`${YT_ACCESS_COOKIE}=`);
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("id-token-value");
    const sealed = cookiePairs(response)
      .split("; ")
      .find((part) => part.startsWith(`${YT_ACCESS_COOKIE}=`))
      ?.slice(YT_ACCESS_COOKIE.length + 1);
    expect(await openPendingYouTubeAuth(sealed ? decodeURIComponent(sealed) : undefined)).toEqual({
      accessToken: ACCESS,
    });
  });

  it("clears the saved token once the channel loads", async () => {
    const response = await completeYouTubeGrant(
      request(),
      "https://smashcollab.com/",
      { accessToken: ACCESS, idToken: null },
      { fetchChannel: async () => channel },
    );
    expect(response.headers.get("location")).toBe("https://smashcollab.com/?yt=ok");
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((line) => line.startsWith(`${YT_ACCESS_COOKIE}=`) && line.includes("Max-Age=0"))).toBe(true);
    const channelCookie = cookies.find((line) => line.startsWith(`${YT_CHANNEL_COOKIE}=`));
    expect(channelCookie).toBeTruthy();
    const token = decodeURIComponent(channelCookie!.split(";")[0].slice(YT_CHANNEL_COOKIE.length + 1));
    const verified = await readVerifiedChannel(token);
    expect(verified?.channel).toBe("@warrenareasocietyofparanormal");
    expect(verified?.subscribers).toBe(1100);
    expect(verified?.subscribersKnown).toBe(true);
  });

  it("still saves the token when the lookup throws", async () => {
    const response = await completeYouTubeGrant(request(), "https://smashcollab.com/", { accessToken: ACCESS, idToken: null }, {
      fetchChannel: async () => {
        throw new Error(`boom ${ACCESS}`);
      },
    });
    expect(response.headers.get("location")).toContain("reason=api");
    expect(response.headers.getSetCookie().join("\n")).not.toContain(ACCESS);
  });
});

describe("resumeYouTubeGrant", () => {
  it("loads the channel from the saved token without a new Google consent", async () => {
    const failed = await completeYouTubeGrant(request(), "https://smashcollab.com/", { accessToken: ACCESS, idToken: "id-token-value" }, {
      fetchChannel: async () => ({ reason: "api" }),
    });
    const seen: string[] = [];
    const resumed = await resumeYouTubeGrant(request(cookiePairs(failed)), "https://smashcollab.com/", {
      fetchChannel: async (accessToken) => {
        seen.push(accessToken);
        return channel;
      },
    });
    expect(seen).toEqual([ACCESS]);
    expect(resumed.headers.get("location")).toBe("https://smashcollab.com/?yt=ok");
    expect(resumed.headers.getSetCookie().join("\n")).toContain("id-token-value");
  });

  it("asks for Google sign-in again when the saved token is missing", async () => {
    const response = await resumeYouTubeGrant(request(), "https://smashcollab.com/");
    expect(response.headers.get("location")).toBe("https://smashcollab.com/?yt=error&reason=retry");
  });
});

describe("verifiedChannelFields", () => {
  const base = {
    channelId: "UCwarren",
    channel: "@warrenareasocietyofparanormal",
    email: "owner@example.com",
    subscribers: 1100,
    avgViews: 1250,
    now: 10,
  };

  it("stores a public count and leaves a missing statistics payload untouched", () => {
    expect(verifiedChannelFields({ ...base, statisticsAvailable: true }).subscriberCount).toBe(1100);
    const missing = verifiedChannelFields({
      ...base,
      subscribers: 0,
      avgViews: 0,
      subscribersKnown: false,
      statisticsAvailable: false,
    });
    expect(missing).not.toHaveProperty("subscriberCount");
    expect(missing).not.toHaveProperty("avgViews");
    expect(verifiedChannelFields({ ...base, subscribersHidden: true, statisticsAvailable: true }).subscriberCount).toBeNull();
  });
});

describe("redirectOAuthError", () => {
  it("drops a saved token when the creator cancels Google", async () => {
    const failed = await completeYouTubeGrant(request(), "https://smashcollab.com/", { accessToken: ACCESS, idToken: null }, {
      fetchChannel: async () => ({ reason: "api" }),
    });
    const response = redirectOAuthError(request(cookiePairs(failed)), "https://smashcollab.com/", "denied");
    const cleared = response.headers.getSetCookie().find((line) => line.startsWith(`${YT_ACCESS_COOKIE}=`));
    expect(cleared).toContain("Max-Age=0");
    expect(response.headers.get("location")).toContain("reason=denied");
  });
});
