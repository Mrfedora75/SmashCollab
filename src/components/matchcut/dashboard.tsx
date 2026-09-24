import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Camera, Check, X } from "lucide-react";
import { NICHES, type Niche } from "@/data/creators";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";
import { saveProfile, type DeskProfile } from "@/components/matchcut/onboarding";
import { OauthNotice } from "@/components/matchcut/oauth-notice";

const BIO_LIMIT = 150;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "N";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function readAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      const side = Math.min(image.width, image.height);
      const sx = (image.width - side) / 2;
      const sy = (image.height - side) / 2;
      context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

export function CreatorDashboard({
  open,
  profile,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  profile: DeskProfile;
  onOpenChange: (open: boolean) => void;
  onSave: (profile: DeskProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [channel, setChannel] = useState(profile.channel);
  const [bio, setBio] = useState(profile.bio);
  const [niches, setNiches] = useState<Niche[]>(profile.niches);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName);
    setChannel(profile.channel);
    setBio(profile.bio);
    setNiches(profile.niches);
    setAvatar(profile.avatar);
    setMenuOpen(false);
    setSaved(false);
    setPhotoError("");
  }, [open]);

  function toggle(niche: Niche) {
    setSaved(false);
    setNiches((current) => (current.includes(niche) ? current.filter((item) => item !== niche) : [...current, niche]));
  }

  const canSave = displayName.trim().length > 0 && channel.trim().length > 0 && niches.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dashboard-panel rounded-card border border-line bg-ink p-5 shadow-card sm:p-6" aria-describedby={undefined}>
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-3xl leading-tight">Creator Dashboard</Dialog.Title>
            <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close profile">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="relative size-24">
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-line bg-ink-soft">
                {avatar ? (
                  <img src={avatar} alt="" className="size-full object-cover" />
                ) : (
                  <span className="font-display text-3xl">{initials(displayName)}</span>
                )}
              </div>
              <label className="press absolute right-0 bottom-0 flex size-11 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent">
                <Camera className="size-4" aria-hidden="true" />
                <span className="sr-only">Upload profile picture</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      setPhotoError("Choose an image file.");
                      return;
                    }
                    readAvatar(file)
                      .then((next) => {
                        setAvatar(next);
                        setPhotoError("");
                        setSaved(false);
                      })
                      .catch(() => setPhotoError("That image couldn't be used."));
                  }}
                />
              </label>
            </div>
          </div>
          {photoError ? (
            <p className="mt-2 text-center text-sm text-accent" role="alert">
              {photoError}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Display Name
              <input
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setSaved(false);
                }}
                maxLength={40}
                className="mt-2 h-12 w-full rounded-control border border-line bg-ink px-3 text-sm text-cream"
              />
            </label>
            <label className="block text-sm">
              Nickname / Channel Name
              <input
                value={channel}
                onChange={(event) => {
                  setChannel(event.target.value);
                  setSaved(false);
                }}
                maxLength={40}
                className="mt-2 h-12 w-full rounded-control border border-line bg-ink px-3 text-sm text-cream"
              />
            </label>
          </div>

          <label className="mt-4 block text-sm" htmlFor="profile-bio">
            Short Bio
          </label>
          <textarea
            id="profile-bio"
            value={bio}
            maxLength={BIO_LIMIT}
            onChange={(event) => {
              setBio(event.target.value.slice(0, BIO_LIMIT));
              setSaved(false);
            }}
            rows={3}
            aria-describedby="bio-count"
            className="mt-2 w-full resize-none rounded-control border border-line bg-ink px-3 py-3 text-sm leading-relaxed text-cream"
          />
          <p id="bio-count" className="mt-1 text-right text-xs text-muted">
            {bio.length}/{BIO_LIMIT}
          </p>

          <div className="relative mt-2">
            <p id="dash-niches" className="text-sm">
              Niche Tags
            </p>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-labelledby="dash-niches"
              onClick={() => setMenuOpen((current) => !current)}
              className="press mt-2 flex h-12 w-full items-center justify-between rounded-control border border-line px-3 text-left text-sm"
            >
              <span className={niches.length === 0 ? "text-muted" : ""}>
                {niches.length === 0 ? "Select niche tags" : niches.join(", ")}
              </span>
              <span aria-hidden="true">{menuOpen ? "–" : "+"}</span>
            </button>
            {menuOpen ? (
              <ul
                role="listbox"
                aria-multiselectable="true"
                aria-labelledby="dash-niches"
                className="mt-2 max-h-48 overflow-auto rounded-control border border-line"
              >
                {NICHES.map((niche) => {
                  const on = niches.includes(niche);
                  return (
                    <li key={niche}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => toggle(niche)}
                        className={cn(
                          "press flex h-11 w-full items-center justify-between px-3 text-left text-sm",
                          on && "bg-ink-soft",
                        )}
                      >
                        {niche}
                        {on ? <Check className="size-4 text-accent" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <section className="mt-6 rounded-card border border-line bg-ink-soft p-4">
            <h2 className="text-sm font-medium">Verified YouTube Stats</h2>
            <p className="mt-1 text-xs text-muted">Read-only. Taken from the YouTube connection.</p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted">Subscribers</dt>
                <dd className="mt-1 font-display text-3xl leading-none">{formatCount(profile.subscribers)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Average views</dt>
                <dd className="mt-1 font-display text-3xl leading-none">{formatCount(profile.avgViews)}</dd>
              </div>
            </dl>
          </section>

          <div className="mt-6">
            <OauthNotice tone="dark" />
          </div>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              const next: DeskProfile = {
                ...profile,
                displayName: displayName.trim(),
                channel: channel.trim(),
                bio,
                niches,
                avatar,
              };
              saveProfile(next);
              onSave(next);
              setSaved(true);
            }}
            className="press mt-6 h-12 w-full rounded-control bg-accent text-sm font-medium text-on-accent disabled:opacity-40"
          >
            Save Changes
          </button>
          {saved ? (
            <p className="mt-2 text-center text-sm text-cream" role="status">
              Changes saved.
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
