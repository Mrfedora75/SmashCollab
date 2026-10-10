/**
 * Plan facts shown on the public pages (landing + /pricing). Display only: real prices
 * live in Stripe and the limits are enforced on the server (collab-policy.ts).
 */
import { FREE_DAILY, PLUS_SUBSCRIBER_MIN } from "@/data/creators";
import { INVITE_REWARDS_PER_MONTH } from "@/lib/referrals";
import { MIN_AGE } from "@/lib/profile-policy";

export const PRICING = {
  freeDaily: FREE_DAILY,
  subscriberLimit: PLUS_SUBSCRIBER_MIN,
  plusMonthly: "$7",
  plusAnnual: "$75",
  extraCollab: "$1",
} as const;

export const SUBSCRIBER_LIMIT_LABEL = PLUS_SUBSCRIBER_MIN.toLocaleString("en-US");


/**
 * Plain Free-plan disclosure for the landing page and /pricing. Every number comes from
 * the constants the server enforces (FREE_DAILY, PLUS_SUBSCRIBER_MIN, INVITE_REWARDS_PER_MONTH,
 * MIN_AGE, REFERRAL_PLUS_MS). Keep this in sync if a restriction is added.
 */
export const FREE_INCLUDES = [
  "A creator profile linked to your YouTube channel (sign in with Google; we never see your password)",
  "Browse every creator on Smash Collab, of every niche and size, with filters and search",
  `${FREE_DAILY} free collab requests per day, resetting at midnight UTC`,
  "Matches and unlimited messaging with creators you match with",
  "Invite friends: each invite gives the new creator 14 days of Plus, and gives you 14 days of Plus",
] as const;

export const FREE_RESTRICTIONS = [
  `${FREE_DAILY} free collab requests per day. After that, wait until midnight UTC, buy an extra collab for ${PRICING.extraCollab}, or upgrade to Plus.`,
  `Free collabs only go to channels under ${SUBSCRIBER_LIMIT_LABEL} subscribers. Channels with ${SUBSCRIBER_LIMIT_LABEL}+ subscribers, or that hide their subscriber count, need Plus or a ${PRICING.extraCollab} collab.`,
  `Invite rewards: you earn invite Plus for at most ${INVITE_REWARDS_PER_MONTH} invites per calendar month. More friends can still join, you just don't get more Plus time that month.`,
  "Messaging only opens after both creators send each other a collab (a match).",
  `You must be ${MIN_AGE} or older, and your profile only appears to other creators after you verify your YouTube channel.`,
] as const;

/** What other signed-in creators can see about you (both plans). */
export const FREE_DATA_SHOWN =
  "Your display name, channel handle, profile photo, subscriber count (from YouTube), average views, niche tags, bio, the location you choose (country, US state, county), and a Plus badge if you have Plus. Never your email.";

/** What is blurred or locked for Free users. Checked against the app code: only the 5K+ collab lock exists. */
export const FREE_BLURRED = [
  `Nothing on creator cards is blurred or hidden on Free. You see the same profile details, stats and subscriber counts as Plus.`,
  `Cards for channels with ${SUBSCRIBER_LIMIT_LABEL}+ subscribers show a lock note: you can view them, but sending a collab to them needs Plus or a ${PRICING.extraCollab} collab.`,
  "Until you confirm your age, accept the terms and sign in, the app behind those windows is blurred for everyone (Free and Plus). Guest mode shows sample channels instead.",
] as const;
