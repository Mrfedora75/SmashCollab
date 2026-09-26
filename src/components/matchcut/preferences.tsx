import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function PreferencesModal({
  open,
  pushEnabled,
  asking,
  blocked,
  onOpenChange,
  onToggle,
  onAllow,
  onBlock,
  onUnblock,
}: {
  open: boolean;
  pushEnabled: boolean;
  asking: boolean;
  blocked: { creatorId: string; channel: string }[];
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onAllow: () => void;
  onBlock: () => void;
  onUnblock: (creatorId: string) => void;
}) {
  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="modal-panel rounded-card border border-line bg-ink p-5 shadow-card" aria-describedby={undefined}>
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="font-display text-3xl leading-tight">Preferences</Dialog.Title>
              <Dialog.Close className="press flex size-11 items-center justify-center rounded-full border border-line" aria-label="Close preferences">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <label htmlFor="push-toggle" className="text-sm font-medium">
                Enable Push Notifications
              </label>
              <button
                id="push-toggle"
                type="button"
                role="switch"
                aria-checked={pushEnabled}
                onClick={onToggle}
                className="press flex h-11 w-14 shrink-0 items-center rounded-full px-1"
              >
                <span className={cn("relative h-7 w-12 rounded-full", pushEnabled ? "bg-accent" : "bg-muted")}>
                  <span
                    className={cn(
                      "absolute top-0.5 size-6 rounded-full bg-cream",
                      pushEnabled ? "right-0.5" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </div>
            <p id="push-hint" className="mt-2 text-sm leading-relaxed text-muted">
              Get instantly alerted when you receive a new pitch or chat message.
            </p>
            <section className="mt-6 border-t border-line pt-5">
              <h2 className="text-sm font-medium">Blocked Users</h2>
              {blocked.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No blocked creators.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {blocked.map((user) => (
                    <li key={user.creatorId} className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm">{user.channel}</p>
                      <button
                        type="button"
                        onClick={() => onUnblock(user.creatorId)}
                        className="press h-11 shrink-0 rounded-control border border-line px-3 text-sm"
                      >
                        Unblock
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={asking}>
        <Dialog.Portal>
          <Dialog.Overlay className="notify-scrim" />
          <Dialog.Content
            className="notify-prompt rounded-card border border-cream-deep bg-cream p-4 text-ink-text shadow-card"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <Dialog.Title className="text-sm leading-relaxed font-medium">
              Smash Collab would like to send you notifications.
            </Dialog.Title>
            <Dialog.Description className="sr-only">Choose whether Smash Collab can show notification alerts.</Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onBlock}
                className="press h-11 rounded-control border border-cream-deep px-4 text-sm font-medium"
              >
                Block
              </button>
              <button
                type="button"
                onClick={onAllow}
                className="press h-11 rounded-control bg-accent px-4 text-sm font-medium text-on-accent"
              >
                Allow
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
