"use client";

const WHATSAPP_NUMBER = "2347080195042"; // no + or leading zeros, per wa.me format
const CONTACT_EMAIL = "suibing15@gmail.com";

export default function WhatsAppButton({ message }: { message?: string }) {
  const defaultMsg = message ?? "Hello Suibing IT Services, I'd like to know more about your products.";
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(defaultMsg)}`;
  const mailHref = `mailto:${CONTACT_EMAIL}`;

  return (
    <div className="fabStack">
      <a href={mailHref} className="fab mailFab" aria-label={`Email us at ${CONTACT_EMAIL}`} title={CONTACT_EMAIL}>
        <span className="mailIcon" aria-hidden="true">✉</span>
      </a>
      <a href={waHref} target="_blank" rel="noreferrer" className="fab waFab" aria-label="Chat with us on WhatsApp">
        <img src="/whatsapp.svg" alt="" width={28} height={28} />
      </a>
      <style jsx>{`
        .fabStack {
          position: fixed;
          bottom: 22px;
          right: 22px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          z-index: 500;
        }
        .fab {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          text-decoration: none;
        }
        .fab:hover { transform: scale(1.08); }
        .waFab {
          background: #25D366;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.15);
          animation: waPulse 2.5s ease-in-out infinite;
        }
        .waFab:hover { box-shadow: 0 8px 26px rgba(37, 211, 102, 0.5), 0 3px 10px rgba(0,0,0,0.18); }
        .mailFab {
          background: #1B2A4A;
          box-shadow: 0 6px 20px rgba(27, 42, 74, 0.35), 0 2px 8px rgba(0,0,0,0.15);
        }
        .mailFab:hover { box-shadow: 0 8px 26px rgba(27, 42, 74, 0.45), 0 3px 10px rgba(0,0,0,0.18); }
        .mailIcon { font-size: 24px; color: #fff; line-height: 1; }
        @keyframes waPulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.15), 0 0 0 0 rgba(37, 211, 102, 0.5); }
          50% { box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.15), 0 0 0 10px rgba(37, 211, 102, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .waFab { animation: none; }
        }
        @media (max-width: 560px) {
          .fabStack { bottom: 16px; right: 16px; gap: 12px; }
          .fab { width: 52px; height: 52px; }
        }
      `}</style>
    </div>
  );
}
