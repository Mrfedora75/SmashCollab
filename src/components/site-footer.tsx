import { Link } from "@tanstack/react-router";

export const CONTACT_EMAIL = "warrenareasocietyofparanormal@gmail.com";

/** Privacy / Terms links, usable inside modals too. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-strong ${className}`}>
      <Link to="/privacy" className="underline underline-offset-2">
        Privacy Policy
      </Link>
      {" · "}
      <Link to="/terms" className="underline underline-offset-2">
        Terms of Service
      </Link>
    </p>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span>© {new Date().getFullYear()} Smash Collab</span>
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        <Link to="/terms" className="underline underline-offset-2">
          Terms of Service
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
          Contact
        </a>
      </nav>
    </footer>
  );
}
