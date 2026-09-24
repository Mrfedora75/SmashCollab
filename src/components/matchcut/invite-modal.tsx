import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, X } from "lucide-react";
import { fetchReferralStatus, referralLink } from "@/lib/referrals";

export function InviteModal({
  open,
  channel,
  onOpenChange,
}: {
  open: boolean;
  channel: string;
  onOpenChange: (open: boolean) => void;
}) {
  const link = referralLink(channel);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchReferralStatus(channel).then((status) => {
      if (cancelled || !status) return;
      setInvites(status.invites);
    });
    return () => {
      cancelled = true;
    };
  }, [open, channel]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dashboard-panel rounded-card border border-line bg-ink p-5 text-cream shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-3xl leading-tight">Invite Creators</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted">
                Give 14 Days of Plus, Get 14 Days of Plus
              </Dialog.Description>
            </div>
            <Dialog.Close className="press flex size-11 shrink-0 items-center justify-center rounded-full border border-line" aria-label="Close invite">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <label className="mt-6 block text-xs font-medium tracking-widest text-muted uppercase" htmlFor="invite-link">
            Your referral link
          </label>
          <input
            id="invite-link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-12 w-full rounded-control border border-line bg-ink-soft px-3 text-sm text-cream"
          />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent text-sm font-medium text-on-accent"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Link copied" : "Copy Link"}
          </button>

          <p className="mt-4 text-sm text-muted" role="status">
            {invites === 0
              ? "When a new creator joins with your link, you both get 14 days of Plus."
              : invites === 1
                ? "1 creator joined. You both received 14 days of Plus."
                : `${invites} creators joined. Each signup added 14 days of Plus for both of you.`}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
