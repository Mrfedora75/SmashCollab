import { LegalLinks } from "@/components/site-footer";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, Youtube } from "lucide-react";
import { OauthNotice } from "@/components/matchcut/oauth-notice";
import {
  loadProfile,
  saveProfile,
  type DeskProfile,
  type VerifiedChannel,
} from "@/components/matchcut/onboarding-storage";
import type { Auth } from "firebase/auth";
import { continueWithGoogle, saveFirebaseUser, signInToFirebase, describeAuthError, isNeedsVerify } from "@/lib/firebase-user";
import { firebaseAuth } from "@/lib/firebase";
import { clearLoginHint, loadLoginHint, type LoginHint } from "@/lib/login-hint";
import { useDeck } from "@/lib/deck-store";
import { syncStripeAccount } from "@/lib/stripe-client";
import { CreateReadyView } from "@/components/matchcut/onboarding-create-ready";

export function CreateProfile({
  onComplete,
  onDismiss,
  verifiedChannel = null,
}: {
  onComplete: (profile: DeskProfile, warning?: string) => void;
  /** Close the prompt (back to the public landing page). Offered before sign-in starts. */
  onDismiss?: () => void;
  verifiedChannel?: VerifiedChannel | null;
}) {
  const [phase, setPhase] = useState<"connect" | "loading" | "ready">("connect");
  const [loadingLabel, setLoadingLabel] = useState("Connecting to YouTube");
  const [menuOpen, setMenuOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [verified, setVerified] = useState<VerifiedChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const returning = loadProfile();
  const [hint, setHint] = useState<LoginHint | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  // Double-tap guard: a second tap would open a second popup, and the cancelled first one
  // would flip the screen back to "connect" while the real sign-in is still running.
  const continuing = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = returning ? null : loadLoginHint();
    setHint(saved);
    // Initialise Firebase Auth ahead of the tap so the Google window opens straight away (not popup-blocked).
    if (saved) void firebaseAuth().then(setAuth).catch(() => setAuth(null));
  }, []);

  useEffect(() => {
    if (!verifiedChannel) return;
    setVerified(verifiedChannel);
    const existing = loadProfile();
    if (existing?.niches.length) setPicked(existing.niches);
    setPhase("ready");
    setError(null);
  }, [verifiedChannel]);

  function toggle(niche: string) {
    setPicked((current) =>
      current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche],
    );
  }

  function startYouTubeVerify() {
    setError(null);
    setLoadingLabel("Connecting to YouTube");
    setPhase("loading");
    window.location.assign("/api/youtube/start");
  }

  function useDifferentAccount() {
    clearLoginHint();
    setHint(null);
    startYouTubeVerify();
  }

  async function continueAs() {
    if (continuing.current) return;
    setError(null);
    if (!auth) {
      setError("Still getting sign-in ready. Try again in a moment.");
      return;
    }
    continuing.current = true;
    setBusy(true);
    const release = () => {
      continuing.current = false;
      setBusy(false);
    };
    // login_hint: Google goes straight to the remembered account (no account picker).
    const pending = continueWithGoogle(auth, hint?.email ?? null);
    setLoadingLabel("Signing in");
    setPhase("loading");
    try {
      const result = await pending;
      if (result.status === "cancelled") {
        release();
        setPhase("connect");
        return;
      }
      if (result.status === "needsVerify") {
        // No verified channel on file for this Google account: do the full YouTube verification.
        startYouTubeVerify();
        return;
      }
      saveProfile(result.profile);
      if (result.premium && result.premiumUntil && result.premiumUntil > Date.now()) {
        useDeck.getState().setPremium(true, result.premiumUntil, "Plus restored for this YouTube channel.");
      }
      void syncStripeAccount();
      onComplete(result.profile);
    } catch (error) {
      release();
      setPhase("connect");
      setError(describeAuthError(error));
    }
  }

  async function enterDesk(profile: DeskProfile, back: "connect" | "ready") {
    setError(null);
    setLoadingLabel(back === "connect" ? "Signing in" : "Saving your channel");
    setPhase("loading");
    saveProfile(profile);
    try {
      // The desk only opens with a real Firebase session; otherwise the deck cannot load creators.
      await signInToFirebase();
    } catch (error) {
      if (isNeedsVerify(error)) {
        startYouTubeVerify();
        return;
      }
      setPhase(back);
      setError(describeAuthError(error));
      return;
    }
    let saved = profile;
    let warning: string | undefined;
    try {
      // Onboarding never blanks a bio / location already saved in Firestore.
      saved = await saveFirebaseUser(profile, { mode: "onboarding" });
      saveProfile(saved);
    } catch (error) {
      // Signed in, so the deck works; say plainly that the profile did not reach the account.
      warning = `Your profile was not saved to your account: ${describeAuthError(error)}`;
    }
    onComplete(saved, warning);
  }

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="age-scrim" />
        <Dialog.Content
          className="profile-panel rounded-card bg-cream p-6 text-center text-ink-text shadow-card"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          {onDismiss && phase === "connect" ? (
            <button
              type="button"
              onClick={onDismiss}
              className="press absolute top-3 right-3 flex size-11 items-center justify-center rounded-full border border-cream-deep"
              aria-label="Close and go back"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <p className="text-xs font-medium tracking-widest text-muted-strong">Smash Collab</p>
          <Dialog.Title className="mt-2 font-display text-3xl leading-tight">
            {(returning || hint) && phase === "connect" ? "Welcome back" : "Create Your Profile"}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Connect your YouTube channel with Google, then choose the niches you collab in.
          </Dialog.Description>
          {error ? (
            <p
              className="mx-auto mt-4 max-w-sm rounded-control border border-cream-deep bg-cream-deep/60 px-3 py-2 text-left text-sm text-ink-text"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {phase === "connect" ? (
            <div className="mt-8">
              {returning ? (
                <div className="mx-auto max-w-sm">
                  <p className="font-display text-2xl leading-tight">{returning.channel}</p>
                  <p className="mt-2 text-sm text-muted-strong">
                    Your profile, messages, and blocked creators are still on this device.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void enterDesk(returning, "connect");
                    }}
                    className="press mt-4 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
                  >
                    Sign in
                  </button>
                </div>
              ) : null}
              {!returning && hint ? (
                <div className="mx-auto max-w-sm">
                  <button
                    type="button"
                    onClick={() => {
                      void continueAs();
                    }}
                    disabled={busy}
                    aria-busy={busy}
                    className="press flex h-14 w-full items-center gap-3 rounded-control bg-accent px-4 text-left text-on-accent"
                  >
                    {hint.avatar ? (
                      <img
                        src={hint.avatar}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-medium text-ink-text"
                      >
                        {(hint.displayName || hint.channel).replace(/^@/, "").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">Continue as {hint.channel}</span>
                      {hint.displayName && hint.displayName !== hint.channel ? (
                        <span className="block truncate text-xs opacity-80">{hint.displayName}</span>
                      ) : null}
                    </span>
                  </button>
                  <p className="mt-2 text-xs text-muted-strong">Sign in with Google. No need to verify your channel again.</p>
                  <button
                    type="button"
                    onClick={useDifferentAccount}
                    disabled={busy}
                    className="press mx-auto mt-3 flex h-11 items-center justify-center rounded-control border border-cream-deep px-6 text-sm font-medium"
                  >
                    Use a different account
                  </button>
                </div>
              ) : null}
              {!returning && hint ? null : (
              <button
                type="button"
                onClick={startYouTubeVerify}
                className={
                  returning
                    ? "press mx-auto mt-3 flex h-12 items-center justify-center gap-2 rounded-control border border-cream-deep px-6 text-sm font-medium"
                    : "press mx-auto flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-medium text-on-accent"
                }
              >
                <Youtube className="size-4" aria-hidden="true" />
                Verify via YouTube
              </button>
              )}
              <div className="mx-auto mt-4 max-w-sm">
                <OauthNotice text="We use official Google OAuth for secure sign-in. Creating a basic profile is completely free. We never store your Google password, and any Plus upgrades are securely processed via Stripe." />
                <LegalLinks className="mt-3" />
              </div>
            </div>
          ) : null}

          {phase === "loading" ? (
            <div className="mt-10 flex flex-col items-center gap-3" role="status">
              <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
              <p className="text-sm text-muted-strong">{loadingLabel}</p>
            </div>
          ) : null}

          {phase === "ready" && verified ? (
            <CreateReadyView
              verified={verified}
              picked={picked}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              toggle={toggle}
              onEnter={() => {
                const existing = loadProfile();
                const sameChannel = !existing?.channelId || existing.channelId === verified.channelId;
                const profile: DeskProfile = {
                  displayName: sameChannel && existing?.displayName ? existing.displayName : verified.displayName,
                  channel: verified.channel,
                  channelId: verified.channelId,
                  subscribers: verified.subscribers,
                  avgViews: verified.avgViews,
                  niches: picked,
                  bio: sameChannel ? (existing?.bio ?? "") : "",
                  avatar: verified.avatar ?? (sameChannel ? (existing?.avatar ?? null) : null),
                  ageConfirmed: true,
                };
                saveProfile(profile);
                void enterDesk(profile, "ready");
              }}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
