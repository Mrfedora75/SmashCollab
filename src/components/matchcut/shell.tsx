import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, Settings, X } from "lucide-react";
import { BRACKETS, CREATORS, FREE_DAILY, VIEWER } from "@/data/creators";
import { ACCEPTED_COLLABS, INBOUND_PITCHES, THREADS, type AcceptedCollab, type BlockedCreator, type ChatMessage, type InboundPitch } from "@/data/inbox";
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
import { CreateProfile, TermsModal, loadProfile, loadTerms, type DeskProfile } from "@/components/matchcut/onboarding";
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
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, SavedReview>>({});
  const [pending, setPending] = useState<InboundPitch[]>(INBOUND_PITCHES);
  const [accepted, setAccepted] = useState<AcceptedCollab[]>(ACCEPTED_COLLABS);
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>(THREADS);
  const [chatId, setChatId] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [askingPush, setAskingPush] = useState(false);
  const [blocked, setBlocked] = useState<BlockedCreator[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const { age, choose } = useAgeGate();
  const [terms, setTerms] = useState(false);
  const [profile, setProfile] = useState<DeskProfile | null>(null);
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
      { creatorId: collab.creatorId, channel: creator?.channel ?? "Creator", collab, messages: saved },
    ]);
    setAccepted((current) => current.filter((item) => item.id !== collab.id));
    setChatId(null);
    setToast("User blocked");
  }

  function unblockCreator(creatorId: string) {
    const record = blocked.find((item) => item.creatorId === creatorId);
    if (!record) return;
    setBlocked((current) => current.filter((item) => item.creatorId !== creatorId));
    setAccepted((current) => (current.some((item) => item.id === record.collab.id) ? current : [...current, record.collab]));
    setThreads((current) => ({ ...current, [record.collab.id]: record.messages }));
    setToast("User unblocked");
  }

  const extraPitches = useDeck((state) => state.extraPitches);
  const pitchesToday = swipes.filter((swipe) => swipe.direction === "pitch" && swipe.day === todayKey()).length;
  const remaining = Math.max(0, FREE_DAILY - pitchesToday) + (premium ? 0 : extraPitches);
  const pitchLabel = remaining === 1 ? "1 pitch left" : `${remaining} pitches left`;
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
      status: accepted.some((collab) => collab.creatorId === swipe.creatorId) ? ("accepted" as const) : ("pending" as const),
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
    <div className={deskReady ? "flex min-h-dvh flex-col" : "app-locked flex min-h-dvh flex-col"} inert={!deskReady}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <header className="border-b border-line">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Mark className="size-8 shrink-0 text-cream" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none">SmashCollab</p>
            {signedIn ? (
              <p className="mt-1 truncate text-xs text-muted">
                {pitching.channel} · {formatCount(pitching.subscribers)} · {pitching.niches.join(" & ")}
              </p>
            ) : (
              <button type="button" onClick={signIn} className="press mt-1 text-xs font-medium text-cream">
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
            <p className="px-5 pt-4 text-sm text-muted">Queued on this desk. Nothing is emailed.</p>
            <PitchTray idPrefix="sheet" heading={false} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <PremiumModal />
      <OutOfSwipes />
    </div>
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
            onAccept={(pitch) => {
              const id = `pitch-${pitch.creatorId}`;
              setPending((current) => current.filter((item) => item.creatorId !== pitch.creatorId));
              setAccepted((current) => [
                ...current,
                {
                  id,
                  creatorId: pitch.creatorId,
                  title: pitch.title,
                  when: "Accepted just now",
                  summary: pitch.message,
                },
              ]);
              setThreads((current) => ({
                ...current,
                [id]: [
                  { id: `${id}-them`, from: "them", text: pitch.message },
                  { id: `${id}-you`, from: "you", text: "Accepted. Let's lock the date in this thread." },
                ],
              }));
            }}
            onDecline={(creatorId) => setPending((current) => current.filter((item) => item.creatorId !== creatorId))}
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
      messages={chatId ? (threads[chatId] ?? []) : []}
      onClose={() => setChatId(null)}
      onSend={(text) => {
        if (!chatId) return;
        setThreads((current) => ({
          ...current,
          [chatId]: [...(current[chatId] ?? []), { id: `you-${Date.now()}`, from: "you", text }],
        }));
      }}
      onBlock={blockOpenThread}
    />
    <ReviewModal
      collabId={reviewFor}
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
        onSave={setProfile}
      />
    ) : null}
    <AgeGate age={age} onChoose={choose} />
    <TermsModal open={age === "adult" && !terms} onAccept={() => setTerms(true)} />
    {age === "adult" && terms && !profile ? <CreateProfile onComplete={setProfile} /> : null}
    <div className="toast" aria-live="polite">
      {toast ? <p className="rounded-control bg-cream px-4 py-3 text-sm font-medium text-ink-text shadow-card">{toast}</p> : null}
    </div>
    </>
  );
}
