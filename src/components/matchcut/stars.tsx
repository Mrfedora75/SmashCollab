import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function StarRow({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn("size-4", star <= filled ? "fill-accent text-accent" : "text-muted-strong")}
        />
      ))}
    </span>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (star: number) => void }) {
  return (
    <div className="flex" role="radiogroup" aria-label="Collab rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const on = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            className="press flex size-11 items-center justify-center"
          >
            <Star className={cn("size-6", on ? "fill-accent text-accent" : "text-muted-strong")} />
          </button>
        );
      })}
    </div>
  );
}
