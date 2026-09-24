import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Youtube } from "lucide-react";
import { NICHES, type Niche } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";
import { OauthNotice } from "@/components/matchcut/oauth-notice";

const TERMS_KEY = "matchcut-terms";
const PROFILE_KEY = "matchcut-profile";
export const SESSION_KEY = "matchcut-signed-in";

export type DeskProfile = {
  displayName: string;
  channel: string;
  subscribers: number;
  avgViews: number;
  niches: Niche[];
  bio: string;
  avatar: string | null;
};

type VerifiedChannel = {
  displayName: string;
  channel: string;
  subscribers: number;
  avgViews: number;
  avatar: string | null;
};

function isNiche(value: unknown): value is Niche {
  return typeof value === "string" && (NICHES as readonly string[]).includes(value);
}

function isAvatarUrl(value: string): boolean {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  );
}

export function loadTerms(): boolean {
  return localStorage.getItem(TERMS_KEY) === "accepted";
}

export function clearSession() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.setItem(SESSION_KEY, "0");
}

export function saveProfile(profile: DeskProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(SESSION_KEY, "1");
}

export function loadProfile(): DeskProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeskProfile>;
    const niches = Array.isArray(parsed.niches) ? parsed.niches.filter(isNiche) : [];
    if (typeof parsed.channel !== "string" || typeof parsed.subscribers !== "number" || niches.length === 0) {
      return null;
    }
    const avatar =
      typeof parsed.avatar === "string" && isAvatarUrl(parsed.avatar) ? parsed.avatar : null;
    return {
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName
          : parsed.channel,
      channel: parsed.channel,
      subscribers: parsed.subscribers,
      avgViews: typeof parsed.avgViews === "number" ? parsed.avgViews : 0,
      niches,
      bio: typeof parsed.bio === "string" ? parsed.bio.slice(0, 150) : "",
      avatar,
    };
  } catch {
    return null;
  }
}

function ytErrorMessage(reason: string | null): string {
  switch (reason) {
    case "config":
      return "YouTube verification isn’t configured yet.";
    case "denied":
      return "Google sign-in was cancelled or denied. Try again when you’re ready.";
    case "state":
      return "That sign-in link expired or was invalid. Please try Verify via YouTube again.";
    case "token":
      return "We couldn’t finish Google sign-in. Please try again.";
    case "no_channel":
      return "This Google account doesn’t have a YouTube channel. Create one, then verify again.";
    case "api":
      return "YouTube didn’t return channel stats. Please try again in a moment.";
    default:
      return "YouTube verification failed. Please try again.";
  }
}

function clearYtQueryParams() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("yt") && !url.searchParams.has("reason")) return;
  url.searchParams.delete("yt");
  url.searchParams.delete("reason");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function TermsModal({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="age-scrim" />
        <Dialog.Content
          className="age-panel rounded-card bg-cream p-6 text-ink-text shadow-card"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <p className="text-xs font-medium tracking-widest text-muted-strong">SmashCollab</p>
          <Dialog.Title className="mt-2 font-display text-3xl leading-tight">Safety & Terms</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-strong">
            Pitches stay on this desk. The channels are fictional, and nothing is emailed, uploaded, or billed.
          </Dialog.Description>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            <li>You already confirmed you are 18 or older.</li>
            <li>Notes and reviews are a preview. They are not sent to a creator.</li>
            <li>
              Verify via YouTube uses official Google OAuth and only reads public channel stats (title,
              subscriber count, and thumbnail).
            </li>
          </ul>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(TERMS_KEY, "accepted");
              onAccept();
            }}
            className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent"
          >
            Accept and continue
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
          subscribers: data.subscribers,
          avgViews: data.avgViews,
          avatar: data.avatar,
        });
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
            <div className="mt-6 text-left">
              <p
                className="text-center text-xs font-medium tracking-widest text-muted-strong uppercase"
                role="status"
              >
                Channel verified
              </p>
              <div className="mt-3 flex flex-col items-center gap-2">
                {verified.avatar ? (
                  <img
                    src={verified.avatar}
                    alt=""
                    className="size-16 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <p className="font-display text-3xl leading-tight">{verified.channel}</p>
                <p className="text-sm text-muted-strong">
                  {formatCount(verified.subscribers)} subscribers · read-only
                </p>
              </div>
              <div className="relative mt-6">
                <p id="niche-label" className="text-sm font-medium">
                  Niche tags
                </p>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={menuOpen}
                  aria-labelledby="niche-label"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="press mt-2 flex h-12 w-full items-center justify-between rounded-control border border-cream-deep px-3 text-left text-sm"
                >
                  <span className={picked.length === 0 ? "text-muted-strong" : ""}>
                    {picked.length === 0 ? "Select niche tags" : picked.join(", ")}
                  </span>
                  <span aria-hidden="true">{menuOpen ? "–" : "+"}</span>
                </button>
                {menuOpen ? (
                  <ul
                    role="listbox"
                    aria-multiselectable="true"
                    aria-labelledby="niche-label"
                    className="mt-2 max-h-48 overflow-auto rounded-control border border-cream-deep"
                  >
                    {NICHES.map((niche) => {
                      const on = picked.includes(niche);
                      return (
                        <li key={niche}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() => toggle(niche)}
                            className={cn(
                              "press flex h-11 w-full items-center justify-between px-3 text-left text-sm",
                              on && "bg-cream-deep",
                            )}
                          >
                            {niche}
                            {on ? <Check className="size-4 text-accent-deep" aria-hidden="true" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                disabled={picked.length === 0}
                onClick={() => {
                  const profile: DeskProfile = {
                    displayName: verified.displayName,
                    channel: verified.channel,
                    subscribers: verified.subscribers,
                    avgViews: verified.avgViews,
                    niches: picked,
                    bio: "",
                    avatar: verified.avatar,
                  };
                  saveProfile(profile);
                  onComplete(profile);
                }}
                className="press mt-5 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
              >
                Enter the desk
              </button>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
