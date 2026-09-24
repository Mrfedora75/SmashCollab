import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, Settings, X } from "lucide-react";
import { BRACKETS, CREATORS, FREE_DAILY, VIEWER } from "@/data/creators";
import {
  ACCEPTED_COLLABS,
  INBOUND_PITCHES,
  THREADS,
  type AcceptedCollab,
  type BlockedCreator,
  type ChatMessage,
  type InboundPitch,
} from "@/data/inbox";
import { formatCount, todayKey } from "@/lib/format";
import { useDeck } from "@/lib/deck-store";
import { Mark } from "@/components/matchcut/mark";
import { FilterPanel } from "@/components/matchcut/filter-panel";
import { DiscoveryFilters } from "@/components/matchcut/discovery-filters";
import { PitchTray } from "@/components/matchcut/pitch-tray";
import { DeckStage } from "@/components/matchcut/deck-stage";
import { PremiumModal } from "@/components/matchcut/premium-modal";
import { OutOfSwipes } from "@/components/matchcut/out-of-swipes";
import { AgeGate, useAgeGate } from "@/components/matchcut/age-gate";
import {
  CreateProfile,
  TermsModal,
  loadProfile,
  loadTerms,
  type DeskProfile,
} from "@/components/matchcut/onboarding";
import { Inbox, ChatThread } from "@/components/matchcut/inbox";
import { ReviewModal, type SavedReview } from "@/components/matchcut/review-modal";
import { PreferencesModal } from "@/components/matchcut/preferences";
import { CreatorDashboard } from "@/components/matchcut/dashboard";

const SESSION_KEY = "matchcut-signed-in";

export function MatchcutApp() {
  const hydrate = useDeck((state) => state.hydrate);
  const premium = useDeck((state) => state.premium);
  const notes = useDeck((state) => state.notes);
  const swipes = useDeck((state) => state.swipes);
  const niches = useDeck((state) => state.niches);
  const minBracket = useDeck((state) => state.minBracket);
  const maxBracket = useDeck((state) => state.maxBracket);
  const location = useDeck((state) => state.location);
  const sort = useDeck((state) => state.sort);
  const announcement = useDeck((state) => state.announcement);
  const openPremium = useDeck((state) => state.openPremium);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pitchesOpen, setPitchesOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [reviewFor, setReviewFor] = useState(null);
  const [reviews, setReviews] = useState>({});
  const [pending, setPending] = useState(INBOUND_PITCHES);
  const [accepted, setAccepted] = useState(ACCEPTED_COLLABS);
  const [threads, setThreads] = useState>(THREADS);
  const [chatId, setChatId] = useState(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [askingPush, setAskingPush] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [toast, setToast] = useState(null);

  const { age, choose } = useAgeGate();
  const [terms, setTerms] = useState(false);
  const [profile, setProfile] = useState(null);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    hydrate();
    setTerms(loadTerms());
    setProfile(loadProfile());
    setSignedIn(localStorage.getItem(SESSION_KEY) !== "0");
  }, [hydrate]);

  function logOut() {
    localStorage.setItem(SESSION_KEY, "0");
    setSignedIn(false);
    setDashboardOpen(false);
  }

  function signIn() {
    localStorage.setItem(SESSION_KEY, "1");
    setSignedIn(true);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function blockOpenThread() {
    if (!chatId) return;
    const collab = accepted.find((item) => item.id === chatId);
    if (!collab) return;
    const creator = CREATORS.find((item) => item.id === collab.creatorId);
    const saved = threads[chatId] ?? [];
    setBlocked((current) => [
      ...current.filter((item) => item.creatorId !== collab.creatorId),
      {
        creatorId: collab.creatorId,
        channel: creator?.channel ?? "Creator",
        collab,
        messages: saved,
      },
    ]);
    setAccepted((current) => current.filter((item) => item.id !== collab.id));
    setChatId(null);
    setToast("User blocked");
  }

  function unblockCreator(creatorId: string) {
    const record = blocked.find((item) => item.creatorId === creatorId);
    if (!record) return;
    setBlocked((current) =>
      current.filter((item) => item.creatorId !== creatorId)
    );
    setAccepted((current) =>
      current.some((item) => item.id === record.collab.id)
        ? current
        : [...current, record.collab]
    );
    setThreads((current) => ({
      ...current,
      [record.collab.id]: record.messages,
    }));
    setToast("User unblocked");
  }

  const extraPitches = useDeck((state) => state.extraPitches);
  const pitchesToday = swipes.filter(
    (swipe) => swipe.direction === "pitch" && swipe.day === todayKey()
  ).length;
  const remaining =
    Math.max(0, FREE_DAILY - pitchesToday) + (premium ? 0 : extraPitches);
  const pitchLabel =
    remaining === 1 ? "1 pitch left" : `${remaining} pitches left`;
  const allowance = FREE_DAILY + (premium ? 0 : extraPitches);
  const meter = premium ? 100 : (remaining / Math.max(allowance, 1)) * 100;
  const pitchCount = swipes.filter((swipe) => swipe.direction === "pitch").length;
  const outbound = swipes
    .filter((swipe) => swipe.direction === "pitch")
    .slice()
    .reverse()
    .map((swipe) => ({
      creatorId: swipe.creatorId,
      message: notes[swipe.creatorId] ?? "",
      status: accepted.some((collab) => collab.creatorId === swipe.creatorId)
        ? ("accepted" as const)
        : ("pending" as const),
    }));

  const filtersOn =
    niches.length > 0 ||
    location !== "global" ||
    minBracket !== 0 ||
    maxBracket !== BRACKETS.length - 1 ||
    sort !== "fit";

  const deskReady = age === "adult" && terms && profile != null;
  const pitching = profile ?? VIEWER;

  return (
    <>
