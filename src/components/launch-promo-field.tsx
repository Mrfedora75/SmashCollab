import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check } from "lucide-react";
import {
  LAUNCH_PROMO_CODE,
  LAUNCH_PROMO_COPY,
  PROMO_CODE_PLACEHOLDER,
  PROMO_DUE_TODAY,
  captureLaunchPromoFromUrl,
  evaluateLaunchPromo,
  promoFromSearch,
  readRememberedPromo,
  rememberLaunchPromo,
  type PromoDecision,
} from "@/lib/launch-promo";
import { cn } from "@/lib/cn";

export function useLaunchPromo() {
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const fromUrl = promoFromSearch(searchStr);
  // The query string is the same on the server and the client, so a promo link
  // fills the box on the first paint. A code remembered in this tab is applied
  // after mount (sessionStorage is not available while rendering on the server).
  const [code, setCodeState] = useState(fromUrl);

  useEffect(() => {
    captureLaunchPromoFromUrl();
    if (fromUrl.trim()) {
      setCodeState(fromUrl);
      return;
    }
    const remembered = readRememberedPromo();
    if (remembered) setCodeState(remembered);
  }, [fromUrl]);

  const setCode = (next: string) => {
    setCodeState(next);
    rememberLaunchPromo(next);
  };

  const decision: PromoDecision | null = code.trim() ? evaluateLaunchPromo({ code }) : null;
  return { code, setCode, decision };
}

export function LaunchPromoMessage({
  decision,
  variant = "dark",
  appliedNote,
  id,
}: {
  decision: PromoDecision | null;
  variant?: "dark" | "light";
  /** Extra line under a successful code, for example on the pricing page. */
  appliedNote?: string;
  id?: string;
}) {
  if (!decision) return null;
  const light = variant === "light";
  if (decision.ok) {
    return (
      <div
        id={id}
        role="status"
        className={cn(
          "rounded-control border px-3 py-3 text-sm",
          light ? "border-status-accepted bg-[#e7f6ee] text-ink-text" : "border-status-accepted bg-status-accepted/15 text-cream",
        )}
      >
        <p className="flex items-center gap-2 font-medium">
          <Check className="size-4 shrink-0 text-status-accepted" aria-hidden="true" />
          {LAUNCH_PROMO_CODE} applied
        </p>
        <p className="mt-1 leading-relaxed">{LAUNCH_PROMO_COPY}</p>
        <p className="mt-1 leading-relaxed">{PROMO_DUE_TODAY}</p>
        {appliedNote ? <p className="mt-1 leading-relaxed">{appliedNote}</p> : null}
      </div>
    );
  }
  return (
    <p
      id={id}
      className={cn(
        "rounded-control border px-3 py-3 text-sm",
        light ? "border-accent-deep bg-[#fde8e4] text-accent-deep" : "border-accent text-accent",
      )}
      role="alert"
    >
      {decision.message}
    </p>
  );
}

/** Read-only note for pages that pick the code up from the URL or an earlier visit. */
export function LaunchPromoNotice({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { decision } = useLaunchPromo();
  if (!decision) return null;
  return (
    <div className="mt-3">
      <LaunchPromoMessage decision={decision} variant={variant} />
    </div>
  );
}

/** Promo code entry on the pricing page and the upgrade dialog. */
export function LaunchPromoField({
  variant = "dark",
  id = "launch-promo",
  code,
  onChange,
  decision,
  appliedNote,
}: {
  variant?: "dark" | "light";
  id?: string;
  code: string;
  onChange: (next: string) => void;
  decision: PromoDecision | null;
  appliedNote?: string;
}) {
  const light = variant === "light";
  const inputClass = light
    ? "mt-2 h-12 w-full rounded-control border border-cream-deep bg-cream px-3 text-sm font-medium text-ink-text placeholder:font-normal placeholder:text-muted-strong [color-scheme:light]"
    : "mt-2 h-12 w-full rounded-control border border-line bg-ink px-3 text-sm font-medium text-cream placeholder:font-normal placeholder:text-muted [color-scheme:dark]";
  const labelClass = light ? "block text-sm font-medium text-ink-text" : "block text-sm font-medium text-cream";
  const optionalClass = light ? "font-normal text-muted-strong" : "font-normal text-muted";
  const statusId = `${id}-status`;

  return (
    <div className="mt-4">
      <label htmlFor={id} className={labelClass}>
        Promo code <span className={optionalClass}>(optional)</span>
      </label>
      <input
        id={id}
        name="promo"
        value={code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={PROMO_CODE_PLACEHOLDER}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={decision != null && !decision.ok}
        aria-describedby={decision ? statusId : undefined}
        className={cn(
          inputClass,
          decision?.ok && "border-status-accepted",
          decision && !decision.ok && (light ? "border-accent-deep" : "border-accent"),
        )}
      />
      {decision ? (
        <div className="mt-2">
          <LaunchPromoMessage id={statusId} decision={decision} variant={variant} appliedNote={appliedNote} />
        </div>
      ) : null}
    </div>
  );
}
