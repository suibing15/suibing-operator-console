// =====================================================================
//  Polite lock screen shown when a school is disabled (non-payment).
//  Data is preserved; this only pauses access. Drop into the school app
//  and render it instead of the normal app when checkSchoolActive()
//  returns { active: false }.
// =====================================================================
"use client";

export default function LockScreen({ schoolName }: { schoolName?: string }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, background: "#f6f8fb", textAlign: "center",
    }}>
      <div style={{
        background: "#fff", border: "1px solid #e4e8f0", borderRadius: 16,
        padding: "40px 32px", maxWidth: 440,
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1B2A4A", marginBottom: 10 }}>
          Access temporarily paused
        </h1>
        <p style={{ color: "#45506a", fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          {schoolName ? <strong>{schoolName}</strong> : "This school"}'s SUIBING Bucket access
          is currently paused. Your records are safe and nothing has been lost.
        </p>
        <p style={{ color: "#6b7688", fontSize: 13, lineHeight: 1.7 }}>
          Please contact the administrator to restore access. Once the subscription is
          settled, the system is re-enabled immediately.
        </p>
      </div>
    </div>
  );
}
