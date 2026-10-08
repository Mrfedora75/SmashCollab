import type { ReactNode } from "react";
import { PublicHeader } from "@/components/marketing/public-header";
import { SiteFooter } from "@/components/site-footer";

/** Layout for public, signed-out-friendly pages (pricing, info). */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">{children}</main>
      <SiteFooter />
    </div>
  );
}
