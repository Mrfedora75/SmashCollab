import { create } from "zustand";
import {
  BRACKETS,
  isPlusChannel,
  FREE_DAILY,
  LOCATIONS,
  US_STATES,
  bracketIndex,
  normalizeFilterNiche,
  type Creator,
  type LocationId,
  type UsState,
} from "@/data/creators";
import { defaultPitch, todayKey } from "@/lib/format";
import { clearPlusLocal, readPlusLocal, writePlusLocal } from "@/lib/youtube/plus-client";
import { PitchError, deleteSwipe, deleteSwipes, recordPass, sendPitch, updateSwipeNote, type RemoteSwipe } from "@/lib/collab";
import { utcDayKey } from "@/lib/pitch-policy";

export type DeskSelf = { channel: string; subscribers: number; niches: string[] };

const noteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function reportSync(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not sync with the server.";
  useDeck.getState().setAuthError(message);
}

export type Direction = "pass" | "pitch";
export type SortKey = "fit" | "views" | "subs";
export type Gate = "limit" | "flagship";

export type Swipe = {
  creatorId: string;
  direction: Direction;
  day: string;
  at: number;
  bonus?: boolean;
};

type Persisted = {
  niches: string[];
  minBracket: number;
  maxBracket: number;
  location: LocationId;
  usState: UsState | null;
  sort: SortKey;
  swipes: Swipe[];
  premium: boolean;
  premiumUntil: number | null;
  notes: Record<string, string>;
  extraPitches: number;
  referralDaily: number;
};

export type MembersStatus = "idle" | "loading" | "ready" | "auth" | "error";

const KEY = "matchcut-v1";

function pitchesToday(swipes: Swipe[], day = todayKey()): number {
  return swipes.filter((swipe) => swipe.day === day && swipe.direction === "pitch").length;
}

/** Free pitches used today: the larger of what this browser saw and the server's counter. */
function freeUsedToday(state: Pick<DeckState, "swipes" | "serverFree">): number {
  const server = state.serverFree && state.serverFree.day === utcDayKey() ? state.serverFree.count : 0;
  return Math.max(pitchesToday(state.swipes), server);
}

function isStoredNiche(value: unknown): value is string {
  return typeof value === "string" && normalizeFilterNiche(value) === value;
}

function isLocation(value: unknown): value is LocationId {
  return typeof value === "string" && LOCATIONS.some((item) => item.id === value);
}

function isUsState(value: unknown): value is UsState {
  return typeof value === "string" && (US_STATES as readonly string[]).includes(value);
}

function load(): Partial<Persisted> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const niches = Array.isArray(parsed.niches) ? parsed.niches.filter(isStoredNiche) : [];
    let minBracket = typeof parsed.minBracket === "number" ? Math.round(parsed.minBracket) : 0;
    let maxBracket = typeof parsed.maxBracket === "number" ? Math.round(parsed.maxBracket) : BRACKETS.length - 1;
    minBracket = Math.min(BRACKETS.length - 1, Math.max(0, minBracket));
    maxBracket = Math.min(BRACKETS.length - 1, Math.max(0, maxBracket));
    if (minBracket > maxBracket) [minBracket, maxBracket] = [maxBracket, minBracket];
    const sort: SortKey = parsed.sort === "views" || parsed.sort === "subs" || parsed.sort === "fit" ? parsed.sort : "fit";
    const swipes = Array.isArray(parsed.swipes)
      ? parsed.swipes.filter(
          (swipe): swipe is Swipe =>
            !!swipe &&
            typeof swipe.creatorId === "string" &&
            (swipe.direction === "pass" || swipe.direction === "pitch") &&
            typeof swipe.day === "string" &&
            typeof swipe.at === "number",
        )
          .map((swipe) => ({ ...swipe, bonus: swipe.bonus === true ? true : undefined }))
      : [];
    const notes =
      parsed.notes && typeof parsed.notes === "object"
        ? Object.fromEntries(
            Object.entries(parsed.notes).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          )
        : {};
    const premiumUntil = typeof parsed.premiumUntil === "number" ? parsed.premiumUntil : null;
    const premium = parsed.premium === true && (premiumUntil == null || premiumUntil > Date.now());
    const extraPitches =
      typeof parsed.extraPitches === "number" && parsed.extraPitches > 0 ? Math.floor(parsed.extraPitches) : 0;
    const referralDaily =
      typeof parsed.referralDaily === "number" && parsed.referralDaily > 0
        ? Math.min(200, Math.floor(parsed.referralDaily))
        : 0;
    const location = isLocation(parsed.location) ? parsed.location : "global";
    const usState = isUsState(parsed.usState) ? parsed.usState : null;
    return {
      niches,
      minBracket,
      maxBracket,
      location,
      usState,
      sort,
      swipes,
      premium,
      premiumUntil: premium ? premiumUntil : null,
      notes,
      extraPitches,
      referralDaily,
    };
  } catch {
    return {};
  }
}

function persist(state: DeckState) {
  const data: Persisted = {
    niches: state.niches,
    minBracket: state.minBracket,
    maxBracket: state.maxBracket,
    location: state.location,
    usState: state.usState,
    sort: state.sort,
    swipes: state.swipes,
    premium: state.premium,
    premiumUntil: state.premiumUntil,
    notes: state.notes,
    extraPitches: state.extraPitches,
    referralDaily: state.referralDaily,
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

type DeckState = Persisted & {
  hydrated: boolean;
  premiumOpen: boolean;
  gate: Gate | null;
  /** Friendly reason from the server when it refused a pitch. */
  gateMessage: string | null;
  /** Server's free-pitch counter (UTC day). */
  serverFree: { day: string; count: number } | null;
  setServerFree: (day: string, count: number) => void;
  announcement: string;
  hydrate: () => void;
  toggleNiche: (niche: string) => void;
  setBrackets: (min: number, max: number) => void;
  setLocation: (location: LocationId) => void;
  setDiscovery: (next: {
    niches: string[];
    minBracket: number;
    maxBracket: number;
    location: LocationId;
    usState: UsState | null;
  }) => void;
  setSort: (sort: SortKey) => void;
  clearFilters: () => void;
  gateFor: (creator: Creator, direction: Direction) => Gate | null;
  commit: (creatorId: string, direction: Direction) => void;
  undo: () => void;
  removeSwipe: (creatorId: string) => void;
  resetSwipes: () => void;
  setNote: (creatorId: string, note: string) => void;
  openPremium: (gate?: Gate | null) => void;
  closePremium: () => void;
  setPremium: (premium: boolean, until?: number | null, announcement?: string) => void;
  addExtraPitch: () => void;
  addPurchasedPitches: (count: number) => void;
  setReferralDaily: (count: number) => void;
  usedToday: () => number;
  members: Creator[];
  membersStatus: MembersStatus;
  me: DeskSelf | null;
  setMe: (me: DeskSelf | null) => void;
  matched: string[];
  setMatched: (ids: string[]) => void;
  setRemoteSwipes: (remote: RemoteSwipe[]) => void;
  setPurchasedPitches: (count: number) => void;
  onMatch: ((creatorId: string) => void) | null;
  setOnMatch: (fn: ((creatorId: string) => void) | null) => void;
  authError: string | null;
  setMembers: (members: Creator[], status: MembersStatus) => void;
  setAuthError: (message: string | null) => void;
};

export const useDeck = create<DeckState>((set, get) => ({
  niches: [],
  minBracket: 0,
  maxBracket: BRACKETS.length - 1,
  location: "global",
  usState: null,
  sort: "fit",
  swipes: [],
  premium: false,
  premiumUntil: null,
  notes: {},
  extraPitches: 0,
  referralDaily: 0,
  hydrated: false,
  premiumOpen: false,
  gate: null,
  gateMessage: null,
  serverFree: null,
  setServerFree: (day, count) => {
    if (!day) return;
    set({ serverFree: { day, count: Math.max(0, Math.floor(count)) } });
  },
  announcement: "",
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...load(), hydrated: true });
    const storedUntil = get().premiumUntil;
    const deckUntil = get().premium && typeof storedUntil === "number" ? storedUntil : 0;
    const remembered = Math.max(deckUntil, readPlusLocal() ?? 0);
    if (remembered > Date.now()) {
      writePlusLocal(remembered);
      if (!get().premium || (get().premiumUntil ?? 0) < remembered) {
        set({ premium: true, premiumUntil: remembered });
        persist(get());
      }
    }
  },
  toggleNiche: (niche) => {
    const next = normalizeFilterNiche(niche);
    if (!next) return;
    const niches = get().niches.some((item) => item.toLowerCase() === next.toLowerCase())
      ? get().niches.filter((item) => item.toLowerCase() !== next.toLowerCase())
      : [...get().niches, next];
    set({ niches });
    persist(get());
  },
  setBrackets: (min, max) => {
    const minBracket = Math.max(0, Math.min(min, max));
    const maxBracket = Math.min(BRACKETS.length - 1, Math.max(min, max));
    set({ minBracket, maxBracket });
    persist(get());
  },
  setLocation: (location) => {
    set({ location });
    persist(get());
  },
  setDiscovery: ({ niches, minBracket, maxBracket, location, usState }) => {
    const low = Math.max(0, Math.min(minBracket, maxBracket));
    const high = Math.min(BRACKETS.length - 1, Math.max(minBracket, maxBracket));
    const nextLocation = isLocation(location) ? location : "global";
    const wantsState = nextLocation === "us" || nextLocation === "us-state";
    set({
      niches: niches.flatMap((item) => {
        const next = normalizeFilterNiche(item);
        return next ? [next] : [];
      }),
      minBracket: low,
      maxBracket: high,
      location: nextLocation,
      usState: wantsState && isUsState(usState) ? usState : null,
      announcement: "Discovery filters applied.",
    });
    persist(get());
  },
  setSort: (sort) => {
    set({ sort });
    persist(get());
  },
  clearFilters: () => {
    set({ niches: [], minBracket: 0, maxBracket: BRACKETS.length - 1, location: "global", usState: null, sort: "fit" });
    persist(get());
  },
  gateFor: (creator, direction) => {
    const state = get();
    // Display-only pre-check; the server (POST /api/pitch) makes the real decision.
    if (direction !== "pitch" || state.premium || state.extraPitches > 0) return null;
    if (isPlusChannel(creator.subscribers)) return "flagship";
    if (freeUsedToday(state) >= FREE_DAILY) return "limit";
    return null;
  },
  commit: (creatorId, direction) => {
    const creator = get().members.find((item) => item.id === creatorId);
    if (!creator) return;
    if (get().swipes.some((swipe) => swipe.creatorId === creatorId)) return;
    const gate = get().gateFor(creator, direction);
    if (gate) {
      set({ premiumOpen: true, gate, gateMessage: null });
      return;
    }
    const notes = { ...get().notes };
    if (direction === "pitch" && !notes[creatorId]) notes[creatorId] = defaultPitch(creator, get().me);
    const at = Date.now();
    const swipes = [...get().swipes, { creatorId, direction, day: todayKey(), at }];
    const announcement =
      direction === "pitch"
        ? `Pitch queued for ${creator.channel}.`
        : `Passed on ${creator.channel}.`;
    set({ swipes, notes, announcement });
    persist(get());
    if (direction === "pass") {
      void recordPass(creatorId).catch(reportSync);
      return;
    }
    void sendPitch(creatorId, notes[creatorId] ?? "")
      .then((outcome) => {
        set({ extraPitches: outcome.pitchCredits });
        get().setServerFree(outcome.day, outcome.freeUsedToday);
        persist(get());
        if (outcome.matched) get().onMatch?.(creatorId);
      })
      .catch((error: unknown) => {
        // The server refused or failed: put the card back in the deck.
        set({
          swipes: get().swipes.filter((swipe) => !(swipe.creatorId === creatorId && swipe.at === at)),
          announcement: `Pitch to ${creator.channel} was not sent.`,
        });
        persist(get());
        if (error instanceof PitchError && (error.code === "over_limit" || error.code === "target_unverified" || error.code === "daily_limit")) {
          set({
            premiumOpen: true,
            gate: error.code === "daily_limit" ? "limit" : "flagship",
            gateMessage: error.message,
          });
          return;
        }
        reportSync(error);
      });
  },
  undo: () => {
    const swipes = get().swipes;
    const last = swipes[swipes.length - 1];
    if (!last) return;
    const creator = get().members.find((item) => item.id === last.creatorId);
    set({
      swipes: swipes.slice(0, -1),
      announcement: creator ? `Brought ${creator.channel} back.` : "Undid the last swipe.",
    });
    persist(get());
    void deleteSwipe(last.creatorId).catch(reportSync);
  },
  removeSwipe: (creatorId) => {
    const creator = get().members.find((item) => item.id === creatorId);
    set({
      swipes: get().swipes.filter((swipe) => swipe.creatorId !== creatorId),
      announcement: creator ? `Pulled the pitch for ${creator.channel}.` : "",
    });
    persist(get());
    void deleteSwipe(creatorId).catch(reportSync);
  },
  resetSwipes: () => {
    // Matched creators stay matched; everyone else goes back in the deck.
    const keep = new Set(get().matched);
    const removed = get().swipes.filter((swipe) => !keep.has(swipe.creatorId)).map((swipe) => swipe.creatorId);
    set({
      swipes: get().swipes.filter((swipe) => keep.has(swipe.creatorId)),
      announcement: "The desk is reset. Every unmatched channel is back in the deck.",
    });
    persist(get());
    void deleteSwipes(removed).catch(reportSync);
  },
  setNote: (creatorId, note) => {
    set({ notes: { ...get().notes, [creatorId]: note } });
    persist(get());
    const pending = noteTimers.get(creatorId);
    if (pending) clearTimeout(pending);
    noteTimers.set(
      creatorId,
      setTimeout(() => {
        noteTimers.delete(creatorId);
        void updateSwipeNote(creatorId, note).catch(() => {});
      }, 800),
    );
  },
  openPremium: (gate = null) => set({ premiumOpen: true, gate: gate ?? null, gateMessage: null }),
  closePremium: () => set({ premiumOpen: false, gate: null, gateMessage: null }),
  setPremium: (premium, until = null, announcement) => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    // Bare Upgrade (no until) still gets 30 days so server Plus can persist across logout.
    const premiumUntil = premium
      ? typeof until === "number" && Number.isFinite(until)
        ? until
        : Date.now() + THIRTY_DAYS_MS
      : null;
    set({
      premium,
      premiumUntil,
      announcement:
        announcement ??
        (premium
          ? "Plus is on."
          : "Reverted to the free desk."),
    });
    persist(get());
    // Display cache only. Plus itself lives on the server (Stripe / tester comp / invites).
    if (premium && premiumUntil) writePlusLocal(premiumUntil);
    else if (!premium) clearPlusLocal();
  },
  usedToday: () => freeUsedToday(get()),
  addExtraPitch: () => {
    set({ extraPitches: get().extraPitches + 1, announcement: "1 extra pitch is ready." });
    persist(get());
  },
  addPurchasedPitches: (count) => {
    const extra = Math.max(0, Math.floor(count));
    if (!extra) return;
    set({
      extraPitches: get().extraPitches + extra,
      announcement: extra === 1 ? "1 extra pitch is ready." : `${extra} extra pitches are ready.`,
    });
    persist(get());
  },
  setReferralDaily: (count) => {
    const referralDaily = Math.max(0, Math.min(200, Math.floor(count)));
    if (referralDaily <= get().referralDaily) return;
    const gained = referralDaily - get().referralDaily;
    set({
      referralDaily,
      announcement: `Invite bonus: +${gained} daily pitches.`,
    });
    persist(get());
  },
  members: [],
  membersStatus: "idle",
  me: null,
  setMe: (me) => set({ me }),
  matched: [],
  setMatched: (ids) => set({ matched: ids }),
  onMatch: null,
  setOnMatch: (fn) => set({ onMatch: fn }),
  setPurchasedPitches: (count) => {
    set({ extraPitches: Math.max(0, Math.floor(count)) });
    persist(get());
  },
  setRemoteSwipes: (remote) => {
    const local = new Map(get().swipes.map((swipe) => [swipe.creatorId, swipe]));
    const swipes: Swipe[] = remote
      .slice()
      .sort((a, b) => a.at - b.at)
      .map((item) => ({
        creatorId: item.to,
        direction: item.direction,
        day: item.day,
        at: item.at,
        bonus: local.get(item.to)?.bonus,
      }));
    const notes = { ...get().notes };
    for (const item of remote) if (item.direction === "pitch" && item.note) notes[item.to] = item.note;
    set({ swipes, notes });
    persist(get());
  },
  authError: null,
  setMembers: (members, status) => set({ members, membersStatus: status }),
  setAuthError: (message) => set({ authError: message }),
}));

export function visibleCreators(
  state: Pick<DeckState, "niches" | "minBracket" | "maxBracket" | "location" | "usState" | "sort" | "swipes">,
  members: Creator[],
) {
  const seen = new Set(state.swipes.map((swipe) => swipe.creatorId));
  const matched = members.filter((creator) => {
    const index = bracketIndex(creator.subscribers);
    if (index < state.minBracket || index > state.maxBracket) return false;
    if (state.location === "us" || state.location === "us-state") {
      if (creator.location !== "us") return false;
      if (state.usState && creator.state !== state.usState) return false;
    } else if (state.location !== "global" && creator.location !== state.location) {
      return false;
    }
    if (
      state.niches.length > 0 &&
      !creator.niches.some((niche) =>
        state.niches.some((wanted) => wanted.toLowerCase() === niche.toLowerCase()),
      )
    ) {
      return false;
    }
    return true;
  });
  const unseen = matched.filter((creator) => !seen.has(creator.id));
  unseen.sort((a, b) => {
    if (state.sort === "views") return b.avgViews - a.avgViews;
    if (state.sort === "subs") return b.subscribers - a.subscribers;
    return b.fit - a.fit || a.channel.localeCompare(b.channel);
  });
  return { unseen, matchCount: matched.length };
}
