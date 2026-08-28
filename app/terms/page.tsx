import type { Metadata } from "next";
import BroadcastBar from "@/app/components/BroadcastBar";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of the Suibing IT Services website and products.",
  alternates: { canonical: "/terms" },
};

export default function TermsOfService() {
  return (
    <div className="legal">
      <BroadcastBar />
      <div className="legalInner">
        <a href="/" className="back">← Back to home</a>
        <h1>Terms of Service</h1>
        <p className="updated">Last updated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>

        <p>
          These Terms of Service ("Terms") govern your use of the Suibing IT Services website, and general use
          of our products and services. They are provided by SUIBING LIMITED (RC 9801555), trading as Suibing
          IT Services ("Suibing", "we", "us", "our"). By using our website or applying for a service, you agree
          to these Terms.
        </p>

        <h2>1. Our Services</h2>
        <p>
          We provide software products (SUIBING Bucket, SSMS, SuibingLedger, Tracker) and services (E-Examiner
          Contract, custom/bespoke development, website and app development) as described on our website. Full
          terms for a subscribed client are set out in a signed Service Agreement between Suibing and that
          client; these Terms apply generally to visitors and to matters not otherwise covered by a signed
          Service Agreement.
        </p>

        <h2>2. Applications and Onboarding</h2>
        <p>
          Submitting an application through our website does not guarantee approval. We review every application
          and will contact you regarding next steps, including any applicable fees. Providing false or misleading
          information in an application may result in rejection or termination of service.
        </p>

        <h2>3. Fees and Payment</h2>
        <p>
          Fees for our products and services are set out in your invoice or Service Agreement and are payable in
          Nigerian Naira (NGN) unless otherwise agreed in writing. We reserve the right to set and adjust fees on
          a per-client basis. Payment confirmation submitted through a school portal is reviewed by us before
          being treated as confirmed; submitting a payment does not itself constitute confirmation.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use our services for any unlawful purpose or in violation of any applicable law;</li>
          <li>Attempt to gain unauthorised access to any account, system, or data not belonging to you;</li>
          <li>Interfere with or disrupt the operation of our website or products;</li>
          <li>Submit false payment information or fraudulent documentation.</li>
        </ul>

        <h2>5. Account Access</h2>
        <p>
          Where we provide you with portal access (school key and PIN, or operator credentials), you are
          responsible for keeping those credentials confidential. Notify us immediately if you believe your
          access has been compromised. We may suspend or revoke access where we reasonably believe it is being
          misused.
        </p>

        <h2>6. Intellectual Property</h2>
        <p>
          All software, source code, branding, and content on this website remain the property of Suibing IT
          Services unless otherwise stated. Client data (student records, business records, and similar content
          you submit) remains your property at all times.
        </p>

        <h2>7. Service Availability</h2>
        <p>
          We aim to keep our products available and performing reliably, but we do not guarantee uninterrupted
          or error-free service. We may carry out maintenance, updates, or improvements that temporarily affect
          availability.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by Nigerian law, Suibing's liability arising from your use of our
          website or general services is limited to direct damages, and does not extend to indirect, incidental,
          or consequential loss. Specific liability terms for subscribed clients are set out in their signed
          Service Agreement.
        </p>

        <h2>9. Termination</h2>
        <p>
          We may suspend or terminate access to our website or services where these Terms, or an applicable
          Service Agreement, are materially breached. Termination of a paid subscription is governed by the
          relevant Service Agreement, including applicable notice periods for data retention and deletion.
        </p>

        <h2>10. Governing Law</h2>
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>

        <h2>11. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. The "Last updated" date above reflects the most recent
          revision. Continued use of our website or services after changes take effect constitutes acceptance
          of the revised Terms.
        </p>

        <h2>12. Contact Us</h2>
        <p>
          SUIBING LIMITED (RC 9801555), trading as Suibing IT Services<br />
          Makwalla Junction, Garko LGA, Kano State, Nigeria<br />
          Email: suibing15@gmail.com<br />
          Phone / WhatsApp: +234 706 859 5598
        </p>

        <div className="footNote">These Terms are provided for general information and do not constitute legal advice. For a subscribed client, the signed Service Agreement governs in the event of any conflict with these Terms.</div>
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .legal { min-height: 100vh; background: var(--paper-2); padding: 48px 20px 80px; }
  .legalInner { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 48px; }
  .back { display: inline-block; color: var(--navy); text-decoration: none; font-weight: 600; font-size: 13.5px; margin-bottom: 24px; }
  .back:hover { text-decoration: underline; }
  h1 { font-size: 28px; font-weight: 800; color: var(--ink); margin-bottom: 6px; letter-spacing: -0.01em; }
  .updated { font-size: 13px; color: var(--muted); margin-bottom: 32px; }
  h2 { font-size: 17px; font-weight: 700; color: var(--navy); margin: 32px 0 12px; }
  p { font-size: 14.5px; color: var(--ink-2); line-height: 1.7; margin-bottom: 14px; }
  ul { margin: 0 0 14px 20px; }
  li { font-size: 14.5px; color: var(--ink-2); line-height: 1.7; margin-bottom: 8px; }
  strong { color: var(--ink); }
  .footNote { font-size: 12px; color: var(--muted); margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--line); font-style: italic; }
  @media (max-width: 640px) { .legalInner { padding: 28px 22px; } h1 { font-size: 22px; } }
`;
