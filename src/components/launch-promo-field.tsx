import { useEffect, useState } from "react";
import {
  LAUNCH_PROMO_COPY,
  captureLaunchPromoFromUrl,
  evaluateLaunchPromo,
  readRememberedPromo,
  rememberLaunchPromo,
  type PromoDecision,
} from "@/lib/launch-promo";

export function useLaunchPromo() {
  const [code, setCodeState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    captureLaunchPromoFromUrl();
    const fromUrl = new URLSearchParams(window.location.search).get("promo");
    setCodeState(fromUrl != null && fromUrl.trim() ? fromUrl : readRememberedPromo());
    setReady(true);
  }, []);

  const setCode = (next: string) => {
    setCodeState(next);
    rememberLaunchPromo(next);
  };

  const decision: PromoDecision | null = ready && code.trim() ? evaluateLaunchPromo({ code }) : null;
  return { code, setCode, decision, ready };
}

function messageClass(variant: "dark" | "light", ok: boolean): string {
  if (ok) return variant === "light" ? "text-sm text-muted-strong" : "text-sm text-cream/80";
  return variant === "light" ? "text-sm text-accent-deep" : "text-sm text-accent";
}

export function LaunchPromoMessage({
  decision,
  variant = "dark",
}: {
  decision: PromoDecision | null;
  variant?: "dark" | "light";
}) {
  if (!decision) return null;
  if (decision.ok) {
    return (
      <p className={messageClass(variant, true)}>
        {LAUNCH_PROMO_COPY} Stripe still collects a card.
      </p>
    );
  }
  return (
    <p className={messageClass(variant, false)} role="alert">
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
}: {
  variant?: "dark" | "light";
  id?: string;
  code: string;
  onChange: (next: string) => void;
  decision: PromoDecision | null;
}) {
  const inputClass =
    variant === "light"
      ? "mt-2 h-12 w-full rounded-control border border-cream-deep bg-cream px-3 text-sm text-ink-text"
      : "mt-2 h-12 w-full rounded-control border border-line bg-ink px-3 text-sm text-cream";
  const labelClass = variant === "light" ? "block text-sm font-medium text-ink-text" : "block text-sm font-medium text-cream";

  return (
    <div className="mt-4">
      <label htmlFor={id} className={labelClass}>
        Promo code
      </label>
      <input
        id={id}
        name="promo"
        value={code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="THECONSULTANT"
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={decision != null && !decision.ok}
        className={inputClass}
      />
      {decision ? (
        <div className="mt-2">
          <LaunchPromoMessage decision={decision} variant={variant} />
        </div>
      ) : null}
    </div>
  );
}
