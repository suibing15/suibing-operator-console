import type { Metadata } from "next";
import BroadcastBar from "@/app/components/BroadcastBar";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Suibing IT Services collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicy() {
  return (
    <div className="legal">
      <BroadcastBar />
      <div className="legalInner">
        <a href="/" className="back">← Back to home</a>
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>

        <p>
          SUIBING LIMITED (RC 9801555), trading as Suibing IT Services ("Suibing", "we", "us", "our"),
          respects your privacy. This Privacy Policy explains what information we collect, how we use it,
          and the choices you have, in connection with our website, products (including SUIBING Bucket, SSMS,
          SuibingLedger, Tracker, and E-Examiner services), and the operator console and school/individual
          portals we provide.
        </p>

        <h2>1. Information We Collect</h2>
        <p>Depending on how you interact with us, we may collect:</p>
        <ul>
          <li><strong>Contact information</strong> you provide when applying for a service, applying for a job, or contacting us — name, organisation name, email address, and phone number.</li>
          <li><strong>School records data</strong> that a subscribed school enters into our products (student records, results, attendance, fee records) — this data belongs to the school, and we act only as a service provider processing it on the school's behalf.</li>
          <li><strong>Payment information</strong> — specifically, receipts you upload to confirm a payment, and the amount, date, and any note you provide. We do not collect or store card numbers or bank login credentials.</li>
          <li><strong>Account access credentials</strong> — for the school portal, a PIN you or we set is stored only as a one-way cryptographic hash; we cannot see or recover your actual PIN.</li>
          <li><strong>Usage information</strong> such as pages visited and general device/browser information, collected automatically to help us maintain and improve the service.</li>
        </ul>

        <h2>2. How We Use Information</h2>
        <ul>
          <li>To provide, maintain, and improve our products and services;</li>
          <li>To review and respond to applications for services or employment;</li>
          <li>To process and confirm payments you submit;</li>
          <li>To communicate with you about your account, service updates, or support requests;</li>
          <li>To comply with legal obligations under Nigerian law, including the Nigeria Data Protection Act.</li>
        </ul>

        <h2>3. How We Share Information</h2>
        <p>
          We do not sell your information. We may share information with third parties only where necessary to
          provide our services (for example, our hosting and database infrastructure provider), to comply with
          a legal obligation, or with your explicit consent.
        </p>

        <h2>4. Data Retention</h2>
        <p>
          We retain school records data for as long as a subscription remains active. Where a Service Agreement
          provides for deletion of data at the end of a term, we give at least fourteen (14) days' written notice
          before deleting any data, in line with our standard Service Agreement terms. Prospect applications and
          job applications you submit are retained until approved, rejected, or manually removed by us; you may
          request removal at any time by contacting us.
        </p>

        <h2>5. Your Rights</h2>
        <p>You may, at any time:</p>
        <ul>
          <li>Ask us what information we hold about you or your organisation;</li>
          <li>Ask us to correct inaccurate information;</li>
          <li>Ask us to delete information we hold, subject to any legal or contractual retention requirements;</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p>To exercise any of these rights, contact us using the details below.</p>

        <h2>6. Security</h2>
        <p>
          We take reasonable technical and organisational measures to protect information in our care, including
          restricting access to authorised personnel and using cryptographic hashing for portal access credentials.
          No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2>7. Children's Information</h2>
        <p>
          Our school products process student records on behalf of subscribing schools, who act as the data
          controller for their students' information. Parents or guardians with questions about their child's
          data should contact their school directly, who can in turn reach us.
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The "Last updated" date above reflects the most
          recent revision. Continued use of our services after changes take effect constitutes acceptance of the
          revised policy.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          SUIBING LIMITED (RC 9801555), trading as Suibing IT Services<br />
          Makwalla Junction, Garko LGA, Kano State, Nigeria<br />
          Email: suibing15@gmail.com<br />
          Phone / WhatsApp: +234 706 859 5598
        </p>

        <div className="footNote">This policy is provided for general information and does not constitute legal advice.</div>
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
