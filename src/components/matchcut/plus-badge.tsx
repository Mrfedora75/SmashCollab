import { cn } from "@/lib/cn";

export const PLUS_BADGE_LABEL = "Smash Collab Plus member";

/** Money-green fedora colors (also used by the static preview). */
export const PLUS_BADGE_COLORS = {
  crown: "#2E7D32",
  brim: "#1E8E3E",
  band: "#14532D",
  pinch: "#1B5E20",
} as const;

/**
 * Plus badge: a money-green fedora silhouette with a slightly darker band.
 * A few bold shapes only, so it stays crisp at ~16px on both the cream cards
 * and the dark app background.
 */
export function PlusBadge({ className, size = 16, title = PLUS_BADGE_LABEL }: { className?: string; size?: number; title?: string }) {
  const c = PLUS_BADGE_COLORS;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("inline-block shrink-0 align-[-0.125em]", className)}
    >
      <title>{title}</title>
      {/* Crown with the fedora's center pinch */}
      <path d="M8 19 L9.6 11 C9.9 9.4 11 8.7 12.6 8.8 C14 8.9 15 10.3 16 10.3 C17 10.3 18 8.9 19.4 8.8 C21 8.7 22.1 9.4 22.4 11 L24 19 Z" fill={c.crown} />
      <path d="M16 10.3 C15.6 11.6 15.5 13 15.6 14.2 L16.4 14.2 C16.5 13 16.4 11.6 16 10.3 Z" fill={c.pinch} />
      {/* Band */}
      <path d="M8.7 15.5 H23.3 L24 19 H8 Z" fill={c.band} />
      {/* Brim, edges slightly upturned */}
      <path d="M1.6 19.4 C3.4 18.3 5.6 18.1 8 18.4 H24 C26.4 18.1 28.6 18.3 30.4 19.4 C27.8 22.5 22.6 23.8 16 23.8 C9.4 23.8 4.2 22.5 1.6 19.4 Z" fill={c.brim} />
    </svg>
  );
}
