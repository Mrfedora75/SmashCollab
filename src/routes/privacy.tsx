import { createFileRoute } from "@tanstack/react-router";
import { H2, LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Smash Collab" },
      { name: "description", content: "How Smash Collab collects, uses, and deletes your data, including YouTube data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 25, 2026">
      <p>
        Smash Collab (“we”, “us”) helps YouTube creators find collaboration partners. This policy explains what we collect, why,
        and how you can have it deleted. Questions: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <H2>What we collect</H2>
      <ul className="list-disc pl-5">
        <li>
          <strong>Google account basics</strong> (name, email address, and account ID) when you sign in with Google. Your email is
          used for sign-in and account support and is not shown to other creators.
        </li>
        <li>
          <strong>YouTube channel data (read-only)</strong>: your channel ID, channel name/handle, profile picture, subscriber
          count, and total view and video counts (used to show an average views figure).
        </li>
        <li>
          <strong>Profile details you add</strong>: niches, a short bio, and optional country, state, and county.
        </li>
        <li>
          <strong>Activity on Smash Collab</strong>: who you pass on or pitch, pitch notes, matches, and messages with your matches.
        </li>
        <li>
          <strong>Payments</strong> are handled by Stripe. We never see or store your full card number; we store your Stripe
          customer and subscription IDs and how long your Plus access lasts.
        </li>
      </ul>

      <H2>How we use YouTube data</H2>
      <p>
        We request the <code>youtube.readonly</code> scope only. We use it once, when you verify, to confirm you own the channel
        and to fill in your public creator card (channel name, picture, and size) so other creators can decide whether to pitch
        you. We never upload, edit, delete, comment, or post anything on YouTube, and we do not access your private videos,
        analytics, or messages. We do not store your Google/YouTube access token after verification.
      </p>
      <p>
        Smash Collab uses YouTube API Services. By using Smash Collab you also agree to the{" "}
        <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>, and
        Google’s handling of data is described in the{" "}
        <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>.
      </p>

      <H2>Google API Services User Data Policy</H2>
      <p>
        Smash Collab’s use and transfer of information received from Google APIs adheres to the{" "}
        <a
          className="underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not sell Google user data, do not use it for advertising, and do not
        let humans read it except with your permission, for security, or when required by law.
      </p>

      <H2>Who can see your information</H2>
      <p>
        Signed-in creators can see your public creator card (channel name, picture, subscriber count, average views, niches,
        bio, and location if you add it). Pitch notes are visible to the creator you pitch. Messages are visible only to you and
        the creator you matched with. We share data with service providers that run the app for us — Google Firebase (sign-in
        and database), Vercel (hosting), and Stripe (payments) — only as needed to provide the service.
      </p>

      <H2>Keeping and deleting your data</H2>
      <p>
        We keep your data while your account is active. You can ask us to delete your account and all associated data at any
        time by emailing <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the Google address
        you signed in with. We delete your profile, swipes, matches, and messages within 30 days of a verified request (Stripe
        keeps payment records it is legally required to keep). You can also revoke Smash Collab’s access to your Google account
        at any time at{" "}
        <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <H2>Cookies and local storage</H2>
      <p>
        We use essential, secure cookies to keep you signed in and to remember your Plus status, and your browser’s local storage
        to remember settings like filters. Logging out clears them. We do not use advertising cookies.
      </p>

      <H2>Age</H2>
      <p>Smash Collab is only for people 18 or older.</p>

      <H2>Changes</H2>
      <p>If we change this policy we will update the date above and, for material changes, tell you in the app.</p>
    </LegalPage>
  );
}
