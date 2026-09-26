import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, Settings, Search, X } from "lucide-react";
import { BRACKETS, FREE_DAILY, type Creator } from "@/data/creators";
import type { AcceptedCollab, BlockedCreator, ChatMessage, InboundPitch } from "@/data/inbox";
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
import { CreateProfile, TermsModal, clearSession, loadProfile, loadTerms, saveProfile, SESSION_KEY, type DeskProfile } from "@/components/matchcut/onboarding";
import { loadReviews, saveReviews } from "@/components/matchcut/desk-memory";
import { InviteModal } from "@/components/matchcut/invite-modal";
import { MemberSearch } from "@/components/matchcut/member-search";
import { captureReferralFromUrl, claimPendingReferral, fetchReferralStatus } from "@/lib/referrals";
import { onAuthStateChanged } from "firebase/auth";
import { saveFirebaseUser, describeAuthError, loadFirebaseProfile, signInToFirebase } from "@/lib/firebase-user";
import { loadMemberCreators } from "@/lib/members";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { confirmStripeSession, syncStripeAccount } from "@/lib/stripe-client";
import {
  loadMySwipes,
  sendMessage,
  setMatchBlocked,
  watchInbound,
  watchMatches,
  watchMessages,
  type InboundRemote,
  type RemoteMatch,
  type RemoteMessage,
} from "@/lib/collab";
import { SiteFooter } from "@/components/site-footer";
import { clearYtQueryParams, ytErrorMessage } from "@/components/matchcut/onboarding-helpers";
import type { VerifiedChannel } from "@/components/matchcut/onboarding-storage";
import { Inbox, ChatThread } from "@/components/matchcut/inbox";
import { ReviewModal, type SavedReview } from "@/components/matchcut/review-modal";
import { PreferencesModal } from "@/components/matchcut/preferences";
import { CreatorDashboard } from "@/components/matchcut/dashboard";

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
  const authError = useDeck((state) => state.authError);
  const openPremium = useDeck((state) => state.openPremium);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pitchesOpen, setPitchesOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, SavedReview>>({});
  const [inbound, setInbound] = useState<InboundRemote[]>([]);
  const [matches, setMatches] = useState<RemoteMatch[]>([]);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<RemoteMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const members = useDeck((state) => state.members);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [askingPush, setAskingPush] = useState(false);
  const [memoryReady, setMemoryReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { age, choose } = useAgeGate();
  const [terms, setTerms] = useState(false);
  const [profile, setProfile] = useState<DeskProfile | null>(null);
  const [pendingChannel, setPendingChannel] = useState<VerifiedChannel | null>(null);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    hydrate();
    const storedProfile = loadProfile();
    const sessionOn = localStorage.getItem(SESSION_KEY) !== "0" && storedProfile != null;
    setTerms(loadTerms());
    setProfile(sessionOn ? storedProfile : null);
    setSignedIn(sessionOn);
    setReviews(loadReviews());
    setMemoryReady(true);
  }, [hydrate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const yt = params.get("yt");
    if (yt !== "ok" && yt !== "error") return;
    if (yt === "error") {
      setToast(ytErrorMessage(params.get("reason")));
      clearYtQueryParams();
      return;
    }
    clearYtQueryParams();
    void (async () => {
      try {
        const res = await fetch("/api/youtube/me", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          setToast(ytErrorMessage("unknown"));
          return;
        }
        const data = (await res.json()) as VerifiedChannel;
        const verified: VerifiedChannel = {
          displayName: data.displayName,
          channel: data.channel,
          channelId: data.channelId,
          subscribers: data.subscribers,
          avgViews: data.avgViews,
          avatar: data.avatar,
          premium: data.premium === true,
          premiumUntil: typeof data.premiumUntil === "number" ? data.premiumUntil : null,
        };
        if (
          verified.premium === true &&
          typeof verified.premiumUntil === "number" &&
          verified.premiumUntil > Date.now()
        ) {
          useDeck.getState().setPremium(true, verified.premiumUntil, "Plus restored for this YouTube channel.");
        }
        let existing = loadProfile();
        if (!existing || existing.niches.length === 0) {
          // Returning creator on a fresh device / after logout: restore the saved profile.
          try {
            await signInToFirebase();
            const saved = await loadFirebaseProfile();
            if (saved && (!saved.channelId || saved.channelId === verified.channelId)) existing = saved;
          } catch {
            // Fall through to the niche picker.
          }
        }
        if (existing && existing.niches.length > 0) {
          const next: DeskProfile = {
            displayName: verified.displayName || existing.displayName,
            channel: verified.channel,
            channelId: verified.channelId,
            subscribers: verified.subscribers,
            avgViews: verified.avgViews,
            niches: existing.niches,
            bio: existing.bio,
            avatar: verified.avatar,
            country: existing.country,
            state: existing.state,
            county: existing.county,
          };
          saveProfile(next);
          setProfile(next);
          setSignedIn(true);
          void signInToFirebase()
            .then(() => saveFirebaseUser(next))
            .catch((error) => useDeck.getState().setAuthError(describeAuthError(error)));
          void syncStripeAccount();
          setPendingChannel(null);
          setToast(`Connected ${next.channel}`);
          return;
        }
        setPendingChannel(verified);
        setProfile(null);
        setSignedIn(false);
      } catch {
        setToast(ytErrorMessage("unknown"));
      }
    })();
  }, []);

  useEffect(() => {
    if (!memoryReady) return;
    saveReviews(reviews);
  }, [memoryReady, reviews]);

  useEffect(() => {
    useDeck.getState().setMe(profile ? { channel: profile.channel, subscribers: profile.subscribers, niches: profile.niches } : null);
  }, [profile]);

  useEffect(() => {
    useDeck.getState().setOnMatch((creatorId) => {
      const creator = useDeck.getState().members.find((item) => item.id === creatorId);
      setToast(`It's a match${creator ? ` with ${creator.channel}` : ""}! Say hi in Matches & Messages.`);
    });
    return () => useDeck.getState().setOnMatch(null);
  }, []);

  function logOut() {
    useDeck.getState().setMembers([], "auth");
    useDeck.getState().setAuthError(null);
    clearSession();
    setSignedIn(false);
    setProfile(null);
    setDashboardOpen(false);
    setInboxOpen(false);
    setFiltersOpen(false);
    setPitchesOpen(false);
    setPrefsOpen(false);
    setInviteOpen(false);
    setChatId(null);
    setReviewFor(null);
  }

  function finishSignIn(next: DeskProfile) {
    setProfile(next);
    setSignedIn(true);
    useDeck.getState().setAuthError(null);
    void claimPendingReferral(next.channel).then((until) => {
      if (!until) return;
      // Re-read Plus from the server, which recorded the invite reward.
      void syncStripeAccount();
      setToast("14 days of Plus from your invite.");
    });
  }

  useEffect(() => {
    if (!signedIn || !profile) return;
    let stop = () => {};
    let cancelled = false;
    void firebaseAuth().then((auth) => {
      if (cancelled) return;
      if (!auth) {
        useDeck.getState().setAuthError("Firebase is not configured.");
        useDeck.getState().setMembers([], "auth");
        return;
      }
      const current = profile;
      let request = 0;
      let unwatch: Array<() => void> = [];
      const stopAuth = onAuthStateChanged(auth, (user) => {
        const ticket = ++request;
        for (const fn of unwatch) fn();
        unwatch = [];
        setMyUid(user?.uid ?? null);
        if (!user) {
          useDeck.getState().setMembers([], "auth");
          setInbound([]);
          setMatches([]);
          return;
        }
        void firebaseDb().then((db) => {
          if (!db || ticket !== request) return;
          const onError = (error: unknown) => useDeck.getState().setAuthError(describeAuthError(error));
          unwatch.push(watchInbound(db, user.uid, setInbound, onError));
          unwatch.push(watchMatches(db, user.uid, setMatches, onError));
        });
        void loadMySwipes()
          .then((remote) => {
            if (ticket === request) useDeck.getState().setRemoteSwipes(remote);
          })
          .catch((error) => useDeck.getState().setAuthError(describeAuthError(error)));
        useDeck.getState().setMembers([], "loading");
        void loadMemberCreators({ channelId: current.channelId, channel: current.channel })
          .then((result) => {
            if (ticket !== request) return;
            if (result.status === "ready") useDeck.getState().setAuthError(null);
            useDeck.getState().setMembers(result.members, result.status);
          })
          .catch((error) => {
            if (ticket !== request) return;
            useDeck.getState().setAuthError(describeAuthError(error));
            useDeck.getState().setMembers([], "error");
          });
      });
      stop = () => {
        stopAuth();
        for (const fn of unwatch) fn();
        unwatch = [];
      };
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [signedIn, profile]);

  useEffect(() => {
    captureReferralFromUrl();
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const checkout = params.get("checkout");
    if (checkout) {
      params.delete("checkout");
      params.delete("session_id");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
    void (async () => {
      if (checkout === "success" && sessionId) {
        setToast(await confirmStripeSession(sessionId));
        return;
      }
      if (checkout === "cancel") setToast("Checkout canceled. No charge was made.");
      await syncStripeAccount();
    })();
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    // Registers this creator's invite code on the server and refreshes Plus (invite rewards live there).
    void fetchReferralStatus().then((status) => {
      if (cancelled || !status || status.plusUntil <= Date.now()) return;
      void syncStripeAccount();
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const lookup = (creatorId: string): Creator | undefined => members.find((item) => item.id === creatorId);
  const swipedIds = new Set(swipes.map((swipe) => swipe.creatorId));
  const hiddenMatches = new Set(matches.filter((match) => match.blockedBy).map((match) => match.other));
  const pending: InboundPitch[] = inbound
    .filter((item) => !swipedIds.has(item.from) && !hiddenMatches.has(item.from))
    .map((item) => ({ creatorId: item.from, ago: timeAgo(item.at), message: item.note || "Wants to collab.", title: "Collab pitch" }));
  const collabFor = (match: RemoteMatch): AcceptedCollab => {
    const creator = lookup(match.other);
    const theirNote = inbound.find((item) => item.from === match.other)?.note;
    return {
      id: match.id,
      creatorId: match.other,
      title: `Collab with ${creator?.channel ?? "a creator"}`,
      when: `Matched ${new Date(match.createdAt).toLocaleDateString()}`,
      summary: theirNote || notes[match.other] || "You both pitched.",
      blockedBy: match.blockedBy,
    };
  };
  const accepted: AcceptedCollab[] = matches.filter((match) => !match.blockedBy).map(collabFor);
  const blocked: BlockedCreator[] = matches
    .filter((match) => match.blockedBy && match.blockedBy === myUid)
    .map((match) => ({ creatorId: match.other, channel: lookup(match.other)?.channel ?? "Creator", collab: collabFor(match), messages: [] }));
  const threadMessages: ChatMessage[] = chatMessages.map((message) => ({
    id: message.id,
    from: message.from === myUid ? "you" : "them",
    text: message.text,
  }));

  useEffect(() => {
    useDeck.getState().setMatched(matches.map((match) => match.other));
  }, [matches]);

  useEffect(() => {
    setChatMessages([]);
    setChatError(null);
    if (!chatId) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void watchMessages(chatId, setChatMessages, (error) => setChatError(describeAuthError(error)))
      .then((unsubscribe) => {
        if (cancelled) unsubscribe();
        else stop = unsubscribe;
      })
      .catch((error) => setChatError(describeAuthError(error)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [chatId]);

  function blockOpenThread() {
    if (!chatId) return;
    const id = chatId;
    setChatId(null);
    void setMatchBlocked(id, true)
      .then(() => setToast("User blocked"))
      .catch((error) => setToast(describeAuthError(error)));
  }

  function unblockCreator(creatorId: string) {
    const match = matches.find((item) => item.other === creatorId && item.blockedBy === myUid);
    if (!match) return;
    void setMatchBlocked(match.id, false)
      .then(() => setToast("User unblocked"))
      .catch((error) => setToast(describeAuthError(error)));
  }

  const extraPitches = useDeck((state) => state.extraPitches);
  const pitchesToday = swipes.filter((swipe) => swipe.direction === "pitch" && swipe.day === todayKey()).length;
  const dailyCap = FREE_DAILY;
  const remaining = Math.max(0, dailyCap - pitchesToday) + (premium ? 0 : extraPitches);
  const pitchLabel = remaining === 1 ? "1 pitch left" : `${remaining} pitches left`;
  const allowance = dailyCap + (premium ? 0 : extraPitches);
  const meter = premium ? 100 : (remaining / Math.max(allowance, 1)) * 100;
  const pitchCount = swipes.filter((swipe) => swipe.direction === "pitch").length;
  const outbound = swipes
    .filter((swipe) => swipe.direction === "pitch")
    .slice()
    .reverse()
    .map((swipe) => ({
      creatorId: swipe.creatorId,
      message: notes[swipe.creatorId] ?? "",
      status: accepted.some((collab) => collab.creatorId === swipe.creatorId) ? ("accepted" as const) : ("pending" as const),
    }));
  const filtersOn =
    niches.length > 0 ||
    location !== "global" ||
    minBracket !== 0 ||
    maxBracket !== BRACKETS.length - 1 ||
    sort !== "fit";
  const deskReady = age === "adult" && terms && signedIn && profile != null;
  const pitching = profile ?? { channel: "", subscribers: 0, niches: [] as string[] };

  return (
    <>
    <div className={deskReady ? "flex min-h-dvh flex-col" : "app-locked flex min-h-dvh flex-col"} inert={!deskReady}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <header className="border-b border-line">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Mark className="size-8 shrink-0 text-cream" />
          {signedIn && profile?.avatar ? (
            <img
              src={profile.avatar}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none">Smash Collab</p>
            {signedIn && profile ? (
              <p className="mt-1 truncate text-xs text-muted">
                {pitching.channel} · {formatCount(pitching.subscribers)} · {pitching.niches.join(" & ")}
              </p>
            ) : (
              <button type="button" onClick={() => setSignedIn(false)} className="press mt-1 text-xs font-medium text-cream">
                Sign In
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm">{premium ? "Unlimited pitches" : pitchLabel}</p>
              {!premium ? (
                <div className="mt-1 ml-auto h-1 w-24 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <div className="h-full bg-accent" style={{ width: `${meter}%` }} />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setInboxOpen(true)}
              className="press hidden h-11 items-center rounded-control border border-line px-3 text-sm sm:inline-flex"
            >
              Matches & Messages
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="press hidden h-11 items-center gap-2 rounded-control border border-line px-3 text-sm xl:inline-flex"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
            </button>
            {signedIn && profile ? (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="press hidden h-11 items-center gap-2 rounded-control border border-line px-3 text-sm sm:inline-flex"
              >
                <Search className="size-4" aria-hidden="true" />
                Member Search
              </button>
            ) : null}
            {signedIn && profile ? (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="press h-11 rounded-control border border-line px-3 text-sm"
              >
                Invite Creators
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openPremium(null)}
              className="press h-11 rounded-control bg-accent px-4 text-sm font-medium text-on-accent"
            >
              {premium ? "Plus" : "Upgrade"}
            </button>
            {signedIn ? (
              <button
                type="button"
                onClick={() => setDashboardOpen(true)}
                className="press h-11 rounded-control border border-line px-3 text-sm"
              >
                My Profile
              </button>
            ) : null}
            {signedIn ? (
              <button
                type="button"
                onClick={logOut}
                className="press h-11 rounded-control border border-line px-3 text-sm"
              >
                Log Out
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="press flex size-11 items-center justify-center rounded-full border border-line"
              aria-label="Settings"
            >
              <Settings className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-3 xl:hidden">
          <button
            type="button"
            onClick={() => setInboxOpen(true)}
            className="press flex h-11 items-center justify-center rounded-control border border-line text-sm sm:hidden"
          >
            Matches & Messages
            {pending.length > 0 ? ` · ${pending.length}` : ""}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-line text-sm sm:hidden"
            >
              <Search className="size-4" aria-hidden="true" />
              Search
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-line text-sm"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters{filtersOn ? " · on" : ""}
            </button>
            <button
              type="button"
              onClick={() => setPitchesOpen(true)}
              className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-line text-sm"
            >
              Pitches{pitchCount > 0 ? ` · ${pitchCount}` : ""}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-line lg:block">
          <FilterPanel />
        </aside>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="px-4 pt-4 sm:hidden">
            <p className="text-sm text-muted">{premium ? "Unlimited pitches" : `${pitchLabel} today`}</p>
            {!premium ? (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${meter}%` }} />
              </div>
            ) : null}
          </div>
          {authError ? (
            <p className="mx-4 mt-4 rounded-control border border-line bg-ink-soft px-4 py-3 text-sm text-cream" role="alert">
              {authError}
            </p>
          ) : null}
          <DeckStage channel={pitching.channel} subscribers={pitching.subscribers} />
        </main>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-line xl:block">
          <PitchTray idPrefix="desk" />
        </aside>
      </div>

      <DiscoveryFilters open={filtersOpen} onOpenChange={setFiltersOpen} />

      <Dialog.Root open={pitchesOpen} onOpenChange={setPitchesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay xl:hidden" />
          <Dialog.Content className="drawer drawer-right border-l border-line bg-ink xl:hidden" aria-describedby={undefined}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <Dialog.Title className="font-display text-2xl">Pitches</Dialog.Title>
              <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close pitches">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <p className="px-5 pt-4 text-sm text-muted">They see your pitch in their inbox. If they pitch back, you match.</p>
            <PitchTray idPrefix="sheet" heading={false} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PremiumModal />
      <OutOfSwipes />
    </div>
    <SiteFooter />
    <Dialog.Root open={inboxOpen} onOpenChange={setInboxOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer drawer-right border-l border-line bg-ink" aria-describedby={undefined}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-2xl">Matches & Messages</Dialog.Title>
            <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close matches">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Inbox
            pending={pending}
            accepted={accepted}
            outbound={outbound}
            premium={premium}
            reviews={reviews}
            heading={false}
            onUpgrade={() => {
              setInboxOpen(false);
              openPremium(null);
            }}
            lookup={lookup}
            onAccept={(pitch) => {
              // Accepting = pitching back, which creates the match.
              useDeck.getState().commit(pitch.creatorId, "pitch");
            }}
            onDecline={(creatorId) => useDeck.getState().commit(creatorId, "pass")}
            onOpen={setChatId}
            onReview={(collabId) => {
              setInboxOpen(false);
              setReviewFor(collabId);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ChatThread
      collab={accepted.find((item) => item.id === chatId) ?? null}
      creator={lookup(accepted.find((item) => item.id === chatId)?.creatorId ?? "")}
      messages={threadMessages}
      error={chatError}
      onClose={() => setChatId(null)}
      onSend={(text) => {
        if (!chatId) return;
        void sendMessage(chatId, text).catch((error) => setChatError(describeAuthError(error)));
      }}
      onBlock={blockOpenThread}
    />
    <ReviewModal
      collabId={reviewFor}
      collab={accepted.find((item) => item.id === reviewFor)}
      creator={lookup(accepted.find((item) => item.id === reviewFor)?.creatorId ?? "")}
      saved={reviewFor ? reviews[reviewFor] : undefined}
      onClose={() => setReviewFor(null)}
      onReturn={() => {
        setReviewFor(null);
        setInboxOpen(true);
      }}
      onSave={(collabId, review) => setReviews((current) => ({ ...current, [collabId]: review }))}
    />
    <PreferencesModal
      open={prefsOpen}
      pushEnabled={pushEnabled}
      asking={askingPush}
      onOpenChange={setPrefsOpen}
      onToggle={() => {
        if (pushEnabled) {
          setPushEnabled(false);
          return;
        }
        setAskingPush(true);
      }}
      onAllow={() => {
        setPushEnabled(true);
        setAskingPush(false);
      }}
      onBlock={() => {
        setPushEnabled(false);
        setAskingPush(false);
      }}
      blocked={blocked}
      onUnblock={unblockCreator}
    />
    {profile ? (
      <CreatorDashboard
        open={dashboardOpen}
        profile={profile}
        onOpenChange={setDashboardOpen}
        onSave={(next) => {
          setProfile(next);
          void saveFirebaseUser(next).catch((error) => {
            useDeck.getState().setAuthError(describeAuthError(error));
          });
        }}
      />
    ) : null}
    {profile ? (
      <InviteModal open={inviteOpen} channel={profile.channel} onOpenChange={setInviteOpen} />
    ) : null}
    <MemberSearch open={searchOpen} onOpenChange={setSearchOpen} />
    <AgeGate age={age} onChoose={choose} />
    <TermsModal open={age === "adult" && !terms} onAccept={() => setTerms(true)} />
    {age === "adult" && terms && !profile ? (
      <CreateProfile verifiedChannel={pendingChannel} onComplete={finishSignIn} />
    ) : null}
    <div className="toast" aria-live="polite">
      {toast ? <p className="rounded-control bg-cream px-4 py-3 text-sm font-medium text-ink-text shadow-card">{toast}</p> : null}
    </div>
    </>
  );
}

function timeAgo(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d`;
}
