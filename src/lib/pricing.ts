/**
 * Plan facts shown on the public pages (landing + /pricing). Display only: real prices
 * live in Stripe and the limits are enforced on the server (collab-policy.ts).
 */
import { FREE_DAILY, PLUS_SUBSCRIBER_MIN } from "@/data/creators";

export const PRICING = {
  freeDaily: FREE_DAILY,
  subscriberLimit: PLUS_SUBSCRIBER_MIN,
  plusMonthly: "$7",
  plusAnnual: "$75",
  extraCollab: "$1",
} as const;

export const SUBSCRIBER_LIMIT_LABEL = PLUS_SUBSCRIBER_MIN.toLocaleString("en-US");
