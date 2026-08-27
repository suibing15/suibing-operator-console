"use client";

const WHATSAPP_NUMBER = "2347080195042"; // no + or leading zeros, per wa.me format

export default function WhatsAppButton({ message }: { message?: string }) {
  const defaultMsg = message ?? "Hello Suibing IT Services, I'd like to know more about your products.";
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(defaultMsg)}`;

  return (
    <a href={href} target="_blank" rel="noreferrer" className="waFab" aria-label="Chat with us on WhatsApp">
      <img src="/whatsapp.svg" alt="" width={28} height={28} />
      <style jsx>{`
        .waFab {
          position: fixed;
          bottom: 22px;
          right: 22px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #25D366;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.15);
          z-index: 500;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: waPulse 2.5s ease-in-out infinite;
        }
        .waFab:hover {
          transform: scale(1.08);
          box-shadow: 0 8px 26px rgba(37, 211, 102, 0.5), 0 3px 10px rgba(0,0,0,0.18);
        }
        @keyframes waPulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.15), 0 0 0 0 rgba(37, 211, 102, 0.5); }
          50% { box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.15), 0 0 0 10px rgba(37, 211, 102, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .waFab { animation: none; }
        }
        @media (max-width: 560px) {
          .waFab { bottom: 16px; right: 16px; width: 52px; height: 52px; }
        }
      `}</style>
    </a>
  );
}
