import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Youtube } from "lucide-react";
import { type Niche } from "@/data/creators";
import { OauthNotice } from "@/components/matchcut/oauth-notice";
import {
  saveProfile,
  type DeskProfile,
  type VerifiedChannel,
} from "@/components/matchcut/onboarding-storage";
import { ytErrorMessage, clearYtQueryParams } from "@/components/matchcut/onboarding-helpers";
import { CreateReadyView } from "@/components/matchcut/onboarding-create-ready";
import { useDeck } from "@/lib/deck-store";

export function CreateProfile({ onComplete }: { onComplete: (profile: DeskProfile) => void }) {
  const [phase, setPhase] = useState<"connect" | "loading" | "ready">("connect");
  const [menuOpen, setMenuOpen] = useState(false);
  const [picked, setPicked] = useState<Niche[]>([]);
  const [verified, setVerified] = useState<VerifiedChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const yt = params.get("yt");
    const reason = params.get("reason");

    if (yt === "error") {
      setError(ytErrorMessage(reason));
      setPhase("connect");
      clearYtQueryParams();
      return;
    }

    if (yt !== "ok") return;

    let cancelled = false;
    setError(null);
    setPhase("loading");
    clearYtQueryParams();

    void (async () => {
      try {
        const res = await fetch("/api/youtube/me", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!cancelled) {
            setError(body?.error ?? ytErrorMessage("unknown"));
            setPhase("connect");
          }
          return;
        }
        const data = (await res.json()) as VerifiedChannel;
        if (cancelled) return;
        setVerified({
          displayName: data.displayName,
          channel: data.channel,
          channelId: data.channelId,
          subscribers: data.subscribers,
          avgViews: data.avgViews,
          avatar: data.avatar,
          premium: data.premium === true,
          premiumUntil: typeof data.premiumUntil === "number" ? data.premiumUntil : null,
        });
        if (
          data.premium === true &&
          typeof data.premiumUntil === "number" &&
          data.premiumUntil > Date.now()
        ) {
          useDeck.getState().setPremium(
            true,
            data.premiumUntil,
            "Plus restored for this YouTube channel.",
          );
        }
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setError(ytErrorMessage("unknown"));
          setPhase("connect");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          <p className="text-xs font-medium tracking-widest text-muted-strong">SmashCollab</p>
          <Dialog.Title className="mt-2 font-display text-3xl leading-tight">Create Your Profile</Dialog.Title>
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
              <button
                type="button"
                onClick={startYouTubeVerify}
                className="press mx-auto flex h-12 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-medium text-on-accent"
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
                const profile: DeskProfile = {
                  displayName: verified.displayName,
                  channel: verified.channel,
                  channelId: verified.channelId,
                  subscribers: verified.subscribers,
                  avgViews: verified.avgViews,
                  niches: picked,
                  bio: "",
                  avatar: verified.avatar,
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
