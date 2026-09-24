import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Youtube } from "lucide-react";
import { type Niche } from "@/data/creators";
import { OauthNotice } from "@/components/matchcut/oauth-notice";
import {
  loadProfile,
  saveProfile,
  type DeskProfile,
  type VerifiedChannel,
} from "@/components/matchcut/onboarding-storage";
import { CreateReadyView } from "@/components/matchcut/onboarding-create-ready";

export function CreateProfile({
  onComplete,
  verifiedChannel = null,
}: {
  onComplete: (profile: DeskProfile) => void;
  verifiedChannel?: VerifiedChannel | null;
}) {
  const [phase, setPhase] = useState<"connect" | "loading" | "ready">("connect");
  const [menuOpen, setMenuOpen] = useState(false);
  const [picked, setPicked] = useState<Niche[]>([]);
  const [verified, setVerified] = useState<VerifiedChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const returning = loadProfile();

  useEffect(() => {
    if (!verifiedChannel) return;
    setVerified(verifiedChannel);
    const existing = loadProfile();
    if (existing?.niches.length) setPicked(existing.niches);
    setPhase("ready");
    setError(null);
  }, [verifiedChannel]);

  function toggle(niche: Niche) {
    setPicked((current) =>
      current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche],
    );
  }

  function startYouTubeVerify() {
    setError(null);
    setPhase("loading");
    window.location.assign("/api/youtube/start");
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
          <p className="text-xs font-medium tracking-widest text-muted-strong">Smash Collab</p>
          <Dialog.Title className="mt-2 font-display text-3xl leading-tight">
            {returning && phase === "connect" ? "Welcome back" : "Create Your Profile"}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Connect your YouTube channel with Google, then choose the niches you pitch in.
          </Dialog.Description>

          {phase === "connect" ? (
            <div className="mt-8">
              {error ? (
                <p
                  className="mx-auto mb-4 max-w-sm rounded-control border border-cream-deep bg-cream-deep/60 px-3 py-2 text-sm text-ink-text"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {returning ? (
                <div className="mx-auto max-w-sm">
                  <p className="font-display text-2xl leading-tight">{returning.channel}</p>
                  <p className="mt-2 text-sm text-muted-strong">
                    Your profile, messages, and blocked creators are still on this device.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      saveProfile(returning);
                      onComplete(returning);
                    }}
                    className="press mt-4 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
                  >
                    Sign in
                  </button>
                </div>
              ) : null}
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
              <div className="mx-auto mt-4 max-w-sm">
                <OauthNotice text="We use official Google OAuth for secure sign-in. Creating a basic profile is completely free. We never store your Google password, and any premium upgrades are securely processed via Stripe." />
              </div>
            </div>
          ) : null}

          {phase === "loading" ? (
            <div className="mt-10 flex flex-col items-center gap-3" role="status">
              <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
              <p className="text-sm text-muted-strong">Connecting to YouTube</p>
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
                };
                saveProfile(profile);
                onComplete(profile);
              }}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
