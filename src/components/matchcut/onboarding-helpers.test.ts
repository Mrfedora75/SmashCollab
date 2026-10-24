import { describe, expect, it } from "vitest";
import { canRetryChannelFetch, ytErrorMessage } from "@/components/matchcut/onboarding-helpers";
import { subscriberCountLabel, subscriberFigure } from "@/lib/format";

describe("ytErrorMessage", () => {
  it("tells the creator they can retry a channel lookup without another Google prompt", () => {
    const message = ytErrorMessage("api");
    expect(message.toLowerCase()).toContain("google sign-in is saved");
    expect(message.toLowerCase()).not.toContain("try again in a moment");
    expect(canRetryChannelFetch("api")).toBe(true);
    expect(canRetryChannelFetch("no_channel")).toBe(true);
  });

  it("does not offer a token retry when there is no token to reuse", () => {
    expect(canRetryChannelFetch("denied")).toBe(false);
    expect(canRetryChannelFetch("token")).toBe(false);
    expect(canRetryChannelFetch("state")).toBe(false);
    expect(canRetryChannelFetch("retry")).toBe(false);
    expect(ytErrorMessage("retry")).toContain("sign in with Google again");
  });
});

describe("subscriber labels", () => {
  it("shows a real count, a hidden count, or that the count was not returned", () => {
    expect(subscriberCountLabel({ subscribers: 1100 })).toBe("1.1K subscribers");
    expect(subscriberCountLabel({ subscribers: 1100, subscribersHidden: true, subscribersKnown: true })).toBe(
      "1.1K subscribers",
    );
    expect(subscriberCountLabel({ subscribers: 0, subscribersHidden: true, subscribersKnown: false })).toBe(
      "Subscribers hidden",
    );
    expect(subscriberCountLabel({ subscribers: 0, subscribersKnown: false })).toBe("Subscriber count unavailable");
    expect(subscriberFigure({ subscribers: 0, subscribersKnown: false })).toBe("Unavailable");
    expect(subscriberFigure({ subscribers: 0, subscribersHidden: true, subscribersKnown: false })).toBe("Hidden");
  });
});
