import { createFileRoute } from "@tanstack/react-router";
import { H2, LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · Smash Collab" },
      { name: "description", content: "The rules for using Smash Collab." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 25, 2026">
      <p>
        These terms apply when you use Smash Collab at smashcollab.com. By signing in you agree to them. If you do not agree,
        please do not use the service.
      </p>

      <H2>Who can use Smash Collab</H2>
      <p>
        You must be 18 or older and must own or be authorized to manage the YouTube channel you verify. One person, one account;
        do not impersonate anyone.
      </p>

      <H2>YouTube and Google</H2>
      <p>
        Smash Collab uses YouTube API Services with read-only access. By using Smash Collab you agree to be bound by the{" "}
        <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>.
        See our <a className="underline" href="/privacy">Privacy Policy</a> and the{" "}
        <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>{" "}
        for how data is handled.
      </p>

      <H2>Behaving well</H2>
      <p>
        No harassment, spam, hate, sexual content involving minors, scams, or illegal activity. You can block anyone you match
        with. We may remove content or suspend accounts that break these rules.
      </p>

      <H2>Collaborations</H2>
      <p>
        Smash Collab introduces creators; it is not a party to any collaboration. You are responsible for your own agreements,
        content, and safety when working with other creators.
      </p>

      <H2>Plus and payments</H2>
      <p>
        Smash Collab Plus is a paid subscription ($7/month or $75/year) and extra pitches can be bought for $1 each. Payments are
        processed by Stripe. Subscriptions renew automatically until canceled; canceling stops future renewals and Plus stays on
        until the end of the paid period. Prices may change with notice. Refunds are handled case by case — contact us.
      </p>

      <H2>Deleting your account</H2>
      <p>
        Email <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to delete your account and data, as
        described in the Privacy Policy.
      </p>

      <H2>No warranty</H2>
      <p>
        The service is provided “as is”. To the extent the law allows, Smash Collab is not liable for indirect or consequential
        losses, and our total liability is limited to what you paid us in the last 12 months.
      </p>

      <H2>Changes</H2>
      <p>We may update these terms; we will change the date above and tell you in the app about material changes.</p>
    </LegalPage>
  );
}
