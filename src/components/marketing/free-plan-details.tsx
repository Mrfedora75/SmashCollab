import { Check, Minus } from "lucide-react";
import { FREE_BLURRED, FREE_DATA_SHOWN, FREE_INCLUDES, FREE_RESTRICTIONS, PRICING } from "@/lib/pricing";

/** Everything in Free and every Free restriction, stated plainly (landing + /pricing). */
export function FreePlanDetails({ className = "" }: { className?: string }) {
  return (
    <section className={`rounded-card border border-line p-6 ${className}`} aria-labelledby="free-plan-details">
      <h2 id="free-plan-details" className="font-display text-2xl">
        Exactly what you get on Free
      </h2>
      <p className="mt-2 text-sm text-cream/80">
        No trial, no card needed, no surprises. Plus is {PRICING.plusMonthly}/month or {PRICING.plusAnnual}/year; extra collabs are{" "}
        {PRICING.extraCollab} each.
      </p>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium tracking-widest text-accent uppercase">Included free</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {FREE_INCLUDES.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium tracking-widest text-accent uppercase">Limits on Free</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {FREE_RESTRICTIONS.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Minus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium tracking-widest text-accent uppercase">Blurred or locked on Free</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {FREE_BLURRED.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Minus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium tracking-widest text-accent uppercase">What other creators see</h3>
          <p className="mt-3 text-sm">{FREE_DATA_SHOWN}</p>
        </div>
      </div>
    </section>
  );
}
