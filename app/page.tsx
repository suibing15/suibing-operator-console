"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WhatsAppButton from "@/app/components/WhatsAppButton";

type Product = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  benefits: string | null;
  icon_emoji: string;
  color_hex: string;
  category: string;
  apply_link: string;
  apply_product_key: string | null;
};

export default function Home() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("list_active_products").then(({ data }) => setProducts((data as Product[]) ?? []));
  }, []);

  function applyHref(p: Product) {
    if (p.apply_product_key) return `${p.apply_link}?product=${encodeURIComponent(p.apply_product_key)}`;
    return p.apply_link;
  }

  return (
    <div className="home">
      <header className="hero">
        <div className="heroBg" aria-hidden="true">
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
        </div>
        <nav className="nav">
          <div className="navBrand"><img src="/logo.png" alt="" className="navLogo" />SUIBING <span>IT Services</span></div>
          <div className="navLinks">
            <a href="/careers">Careers</a>
            <a href="/invoices">Invoices</a>
            <a href="/school-portal">School portal</a>
            <a href="/login" className="navBtn">Operator sign-in</a>
          </div>
        </nav>

        <div className="heroContent">
          <div className="heroBadge">
            <span className="heroBadgeTrack">🇳🇬 Built in Kano, Nigeria — serving schools and businesses nationwide</span>
          </div>
          <h1>Digital solutions that move business forward.</h1>
          <p className="heroSub">
            SUIBING LIMITED designs and builds software for schools, businesses, and individuals —
            from school records and digital examinations to custom web and app development.
            One company, one point of contact, real support behind every product we ship.
          </p>
          <div className="heroActions">
            <a href="/apply" className="btn heroBtn">Apply for a service →</a>
            <a href="#products" className="btn heroBtnGhost">See our products</a>
          </div>
        </div>
      </header>

      <main id="products" className="productsSection">
        <div className="sectionHead">
          <h2>What we build</h2>
          <p>Every product is designed around how schools in Nigeria actually work — click any card to learn more.</p>
        </div>

        {products === null ? (
          <div className="loadingGrid">
            {[1, 2, 3].map((i) => <div key={i} className="skeletonCard" />)}
          </div>
        ) : products.length === 0 ? (
          <p className="empty">Products coming soon.</p>
        ) : (
          <div className="grid">
            {products.map((p, i) => {
              const isOpen = expanded === p.slug;
              const benefits = (p.benefits ?? "").split("\n").map((b) => b.trim()).filter(Boolean);
              return (
                <div
                  key={p.slug}
                  className={`pcard ${isOpen ? "open" : ""}`}
                  style={{ animationDelay: `${i * 0.08}s`, ["--accent" as any]: p.color_hex }}
                  onClick={() => setExpanded(isOpen ? null : p.slug)}
                >
                  <div className="pcardTop">
                    <div className="pIcon" style={{ background: p.color_hex + "18", color: p.color_hex }}>{p.icon_emoji}</div>
                    <span className="pCat">{p.category}</span>
                  </div>
                  <h3>{p.name}</h3>
                  {p.tagline && <p className="pTagline">{p.tagline}</p>}

                  <div className={`pMore ${isOpen ? "shown" : ""}`}>
                    {p.description && <p className="pDesc">{p.description}</p>}
                    {benefits.length > 0 && (
                      <ul className="pBenefits">
                        {benefits.map((b, bi) => <li key={bi}><span className="check" style={{ color: p.color_hex }}>✓</span>{b}</li>)}
                      </ul>
                    )}
                    <a
                      href={applyHref(p)}
                      className="pApply"
                      style={{ background: p.color_hex }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Apply for {p.name} →
                    </a>
                  </div>

                  {!isOpen && <div className="pExpandHint">Tap to learn more</div>}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <section className="whySection">
        <div className="sectionHead">
          <h2>Why schools choose us</h2>
        </div>
        <div className="whyGrid">
          <div className="whyCard">
            <div className="whyIcon">🎓</div>
            <h4>Built for education</h4>
            <p>Every feature is shaped by how Nigerian schools actually run — not generic software adapted after the fact.</p>
          </div>
          <div className="whyCard">
            <div className="whyIcon">🔒</div>
            <h4>Your data, protected</h4>
            <p>Each school's records live in their own isolated space. Export any time, on your terms.</p>
          </div>
          <div className="whyCard">
            <div className="whyIcon">🤝</div>
            <h4>Real, direct support</h4>
            <p>Talk to the people who actually build the software — free onboarding training on every subscription.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footerBrand">
          <img src="/logo.png" alt="" className="footerLogo" />
          <div>
            <div className="footerName">SUIBING LIMITED</div>
            <div className="footerSub">RC 9801555 · trading as Suibing IT Services</div>
          </div>
        </div>
        <div className="footerLinks">
          <a href="/apply">Apply</a>
          <a href="/careers">Careers</a>
          <a href="/invoices">Invoices</a>
          <a href="/school-portal">School portal</a>
          <a href="/login">Operator sign-in</a>
        </div>
        <div className="footerContact">
          Makwalla Junction, Garko LGA, Kano State, Nigeria<br />
          suibing15@gmail.com · +234 706 859 5598
        </div>
        <div className="footerCopyright">© {new Date().getFullYear()} Suibing Limited. All rights reserved.</div>
      </footer>

      <WhatsAppButton />
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .home { background: var(--paper-2); overflow-x: hidden; }

  .hero { position: relative; background: linear-gradient(160deg, #1B2A4A 0%, #14213d 55%, #0d1830 100%); color: #fff; overflow: hidden; padding-bottom: 100px; }
  .heroBg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .blob { position: absolute; border-radius: 50%; filter: blur(2px); opacity: 0.5; }
  .b1 { width: 380px; height: 380px; background: radial-gradient(circle, rgba(46,211,166,0.25), transparent 70%); top: -140px; right: -80px; animation: sbFloat 10s ease-in-out infinite; }
  .b2 { width: 320px; height: 320px; background: radial-gradient(circle, rgba(46,67,114,0.5), transparent 70%); bottom: -160px; left: -100px; animation: sbFloat 13s ease-in-out infinite reverse; }
  .b3 { width: 220px; height: 220px; background: radial-gradient(circle, rgba(183,121,31,0.2), transparent 70%); top: 30%; left: 50%; animation: sbFloat 8s ease-in-out infinite; }

  .nav { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 24px 32px; max-width: 1100px; margin: 0 auto; flex-wrap: wrap; gap: 12px; }
  .navBrand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; }
  .navLogo { width: 32px; height: 32px; border-radius: 8px; }
  .navBrand span { font-weight: 400; color: rgba(255,255,255,0.7); }
  .navLinks { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .navLinks a { color: rgba(255,255,255,0.85); text-decoration: none; font-size: 13.5px; font-weight: 600; }
  .navLinks a:hover { color: #fff; }
  .navBtn { background: rgba(255,255,255,0.12); padding: 8px 16px; border-radius: 999px; }

  .heroContent { position: relative; max-width: 780px; margin: 60px auto 0; padding: 0 32px; text-align: center; }
  .heroBadge { display: inline-flex; align-items: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); padding: 6px 0; border-radius: 999px; font-size: 12.5px; font-weight: 600; margin-bottom: 24px; opacity: 0; animation: sbFadeUp 0.6s ease-out 0.1s forwards, badgeGlow 4s ease-in-out infinite 0.8s; width: 340px; max-width: 82vw; overflow: hidden; position: relative; }
  .heroBadgeTrack { display: inline-block; white-space: nowrap; padding-left: 100%; animation: badgeSlide 11s linear infinite; }
  @keyframes badgeSlide { from { transform: translateX(0); } to { transform: translateX(-100%); } }
  @keyframes badgeGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); } 50% { box-shadow: 0 0 16px 1px rgba(255,255,255,0.12); } }
  @media (prefers-reduced-motion: reduce) {
    .heroBadgeTrack { animation: none; padding-left: 16px; white-space: normal; }
    .heroBadge { width: auto; }
  }
  h1 { font-size: 44px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 20px; opacity: 0; animation: sbFadeUp 0.6s ease-out 0.2s forwards; }
  .heroSub { font-size: 16.5px; color: rgba(255,255,255,0.8); line-height: 1.65; max-width: 600px; margin: 0 auto 34px; opacity: 0; animation: sbFadeUp 0.6s ease-out 0.3s forwards; }
  .heroActions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; opacity: 0; animation: sbFadeUp 0.6s ease-out 0.4s forwards; }
  .heroBtn { padding: 13px 26px; font-size: 15px; border-radius: 10px; }
  .heroBtnGhost { background: transparent; border: 1.5px solid rgba(255,255,255,0.35); color: #fff; padding: 13px 26px; font-size: 15px; border-radius: 10px; text-decoration: none; font-weight: 600; transition: all 0.15s; }
  .heroBtnGhost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.6); }

  @media (max-width: 640px) { h1 { font-size: 32px; } .heroContent { margin-top: 40px; } }

  .productsSection { max-width: 1100px; margin: 40px auto 0; padding: 0 24px 70px; position: relative; }
  .sectionHead { text-align: center; margin-bottom: 40px; }
  .sectionHead h2 { font-size: 28px; font-weight: 800; color: var(--ink); margin-bottom: 10px; letter-spacing: -0.01em; }
  .sectionHead p { font-size: 15px; color: var(--muted); max-width: 480px; margin: 0 auto; line-height: 1.5; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
  .loadingGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
  .skeletonCard { height: 220px; background: linear-gradient(90deg, #eef1f6 0%, #f7f9fc 50%, #eef1f6 100%); background-size: 200% 100%; border-radius: 18px; animation: shimmer 1.5s ease-in-out infinite; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .empty { text-align: center; color: var(--muted); padding: 40px; }

  .pcard {
    background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 26px;
    cursor: pointer; opacity: 0; animation: sbFadeUp 0.5s ease-out forwards;
    box-shadow: 0 2px 10px rgba(20,28,45,0.04);
    transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
    position: relative; overflow: hidden;
  }
  .pcard::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--accent); transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; }
  .pcard:hover { box-shadow: 0 12px 32px rgba(20,28,45,0.1); transform: translateY(-3px); border-color: transparent; }
  .pcard:hover::before, .pcard.open::before { transform: scaleX(1); }
  .pcard.open { box-shadow: 0 16px 40px rgba(20,28,45,0.12); }

  .pcardTop { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .pIcon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; }
  .pCat { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); background: var(--paper-2); padding: 4px 10px; border-radius: 999px; }
  .pcard h3 { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 6px; line-height: 1.3; }
  .pTagline { font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }

  .pMore { max-height: 0; overflow: hidden; transition: max-height 0.4s ease; }
  .pMore.shown { max-height: 600px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
  .pDesc { font-size: 13.5px; color: var(--ink-2); line-height: 1.6; margin-bottom: 14px; }
  .pBenefits { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-bottom: 18px; }
  .pBenefits li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--ink); line-height: 1.5; }
  .pBenefits .check { font-weight: 800; flex-shrink: 0; }
  .pApply { display: block; text-align: center; color: #fff; text-decoration: none; padding: 11px; border-radius: 10px; font-weight: 700; font-size: 13.5px; transition: opacity 0.15s; }
  .pApply:hover { opacity: 0.88; }
  .pExpandHint { font-size: 11.5px; color: var(--muted); margin-top: 14px; font-weight: 600; }

  .whySection { max-width: 1100px; margin: 0 auto; padding: 20px 24px 80px; }
  .whyGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-top: 30px; }
  .whyCard { text-align: center; padding: 10px; }
  .whyIcon { font-size: 36px; margin-bottom: 14px; }
  .whyCard h4 { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
  .whyCard p { font-size: 13.5px; color: var(--muted); line-height: 1.6; }

  .footer { background: #101a30; color: rgba(255,255,255,0.75); padding: 48px 24px; }
  .footerBrand { display: flex; align-items: center; gap: 12px; max-width: 1100px; margin: 0 auto 24px; }
  .footerLogo { width: 36px; height: 36px; border-radius: 8px; }
  .footerName { font-weight: 800; color: #fff; font-size: 15px; }
  .footerSub { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 2px; }
  .footerLinks { max-width: 1100px; margin: 0 auto 20px; display: flex; gap: 20px; flex-wrap: wrap; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .footerLinks a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 13px; font-weight: 600; }
  .footerLinks a:hover { color: #fff; }
  .footerContact { max-width: 1100px; margin: 0 auto; font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.7; }
  .footerCopyright { max-width: 1100px; margin: 20px auto 0; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11.5px; color: rgba(255,255,255,0.4); }
`;
