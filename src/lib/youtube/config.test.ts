import { afterEach, describe, expect, it } from "vitest";
import { getAppHomeUrl, getRequestOrigin, getYouTubeRedirectUri } from "@/lib/youtube/config";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

describe("request origin", () => {
  it("ignores an untrusted forwarded host", () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.APP_ORIGIN;
    const req = request("https://smashcollab.com/api/youtube/start", {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "http",
    });
    expect(getRequestOrigin(req)).toBe("https://smashcollab.com");
    expect(getAppHomeUrl(req)).toBe("https://smashcollab.com/");
    expect(getYouTubeRedirectUri(req)).toBe("https://smashcollab.com/api/youtube/callback");
  });

  it("accepts a forwarded host that is on the allowlist", () => {
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    process.env.APP_ORIGIN = "https://smashcollab.com";
    const req = request("https://internal.local/api/youtube/start", {
      "x-forwarded-host": "smashcollab.com",
      "x-forwarded-proto": "https",
    });
    expect(getRequestOrigin(req)).toBe("https://smashcollab.com");
    expect(getYouTubeRedirectUri(req)).toBe("https://smashcollab.com/api/youtube/callback");
  });

  it("keeps an explicit redirect URI pinned", () => {
    process.env.GOOGLE_REDIRECT_URI = "https://smashcollab.com/api/youtube/callback";
    const req = request("https://smashcollab.com/api/youtube/start", {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    });
    expect(getAppHomeUrl(req)).toBe("https://smashcollab.com/");
    expect(getYouTubeRedirectUri(req)).toBe("https://smashcollab.com/api/youtube/callback");
  });
});
