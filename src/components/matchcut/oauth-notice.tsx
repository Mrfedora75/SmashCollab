import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

export function OauthNotice({
  tone = "light",
  text = "We use official Google OAuth. Smash Collab only accesses your public subscriber count and channel display data. We never see, store, or have access to your Google password or private information.",
}: {
  tone?: "light" | "dark";
  text?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-left text-xs leading-relaxed",
        tone === "dark" ? "text-muted" : "text-muted-strong",
      )}
    >
      <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
