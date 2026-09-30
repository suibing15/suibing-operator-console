// =====================================================================
//  Voice unlock — a fun, on-brand extra step before the console
//  dashboard appears, NOT a real security layer. Real access control
//  is entirely Supabase Auth (password + optional authenticator app),
//  enforced server-side by is_operator() on every table/RPC. This
//  gate is purely client-side, per-browser (localStorage), and can
//  always be turned off from the gate itself — it must never be able
//  to permanently lock an operator out of their own console.
//
//  How it works: the operator records a short passphrase once. It's
//  never stored as audio or as plain text — only a SHA-256 hash of
//  the (normalised) transcript sits in localStorage. On future loads,
//  the gate listens with the browser's built-in speech recognition,
//  hashes what it heard the same way, and compares.
// =====================================================================
"use client";

import { useEffect, useRef, useState } from "react";

export const VOICE_HASH_KEY = "suibing_voice_hash";

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[.,!?'"]/g, "").replace(/\s+/g, " ");
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Recognizer = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function newRecognizer(): Recognizer | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: Recognizer = new Ctor();
  r.lang = "en-GB";
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

function speechErrorMessage(err: string): string {
  if (err === "no-speech") return "Didn't catch that — try speaking a little louder.";
  if (err === "not-allowed" || err === "service-not-allowed") return "Microphone access is blocked. Allow it for this site, or type your phrase instead.";
  if (err === "audio-capture") return "No microphone found.";
  return "Something went wrong listening. Try again, or type your phrase instead.";
}

// ---------------------------------------------------------------------
// The gate itself — shown full-screen before the dashboard, whenever a
// voice phrase is configured on this browser and hasn't been spoken yet
// this page load.
// ---------------------------------------------------------------------
export function VoiceLockGate({ onUnlock, onDisable }: { onUnlock: () => void; onDisable: () => void }) {
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showTyped, setShowTyped] = useState(false);
  const [typed, setTyped] = useState("");
  const recRef = useRef<Recognizer | null>(null);
  const supported = typeof window !== "undefined" && (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  useEffect(() => {
    if (!supported) setShowTyped(true);
  }, [supported]);

  async function checkPhrase(raw: string) {
    const hash = await sha256Hex(normalize(raw));
    const stored = localStorage.getItem(VOICE_HASH_KEY);
    if (hash === stored) { onUnlock(); return; }
    setErr("That didn't match. Try again, or use the text field below.");
  }

  function listen() {
    setErr(null);
    const r = newRecognizer();
    if (!r) { setShowTyped(true); setErr("Voice recognition isn't supported in this browser — type your phrase instead."); return; }
    recRef.current = r;
    r.onresult = (e: any) => { checkPhrase(e.results[0][0].transcript); };
    r.onerror = (e: any) => { setErr(speechErrorMessage(e.error)); setListening(false); };
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }

  function submitTyped() {
    if (!typed.trim()) { setErr("Type your phrase first."); return; }
    checkPhrase(typed);
  }

  function disable() {
    if (!confirm("Turn off voice unlock for this browser? You can always set it up again from the sidebar later.")) return;
    onDisable();
  }

  return (
    <div className="vlWrap">
      <div className="vlCard">
        <div className="vlIcon">{listening ? "👂" : "🎙️"}</div>
        <h2>Voice unlock</h2>
        <p className="vlHint">Say your passphrase to open the console on this browser.</p>

        {!showTyped ? (
          <button className="btn ok vlBtn" type="button" onClick={listen} disabled={listening}>
            {listening ? "Listening…" : "Tap and speak"}
          </button>
        ) : (
          <div className="vlTyped">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your phrase"
              onKeyDown={(e) => { if (e.key === "Enter") submitTyped(); }}
            />
            <button className="btn ok" type="button" onClick={submitTyped}>Unlock</button>
          </div>
        )}

        {err && <div className="vlErr">{err}</div>}

        <div className="vlLinks">
          {!showTyped && <button className="vlLink" type="button" onClick={() => setShowTyped(true)}>Type it instead</button>}
          <button className="vlLink danger" type="button" onClick={disable}>Forgot it? Turn off voice unlock</button>
        </div>

        <p className="vlFooter">Just a fun touch for this browser — your real login is still your password and authenticator.</p>
      </div>

      <style jsx>{`
        .vlWrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--paper, #F6F8FB); }
        .vlCard { width: 100%; max-width: 420px; background: #fff; border: 1px solid var(--line-strong, #e4e8f0); border-radius: 18px; padding: 36px 28px; text-align: center; }
        .vlIcon { font-size: 40px; margin-bottom: 8px; }
        h2 { font-size: 20px; font-weight: 700; color: var(--ink, #1B2A4A); margin-bottom: 8px; }
        .vlHint { font-size: 13.5px; color: var(--ink-2, #45506a); line-height: 1.6; margin-bottom: 22px; }
        .vlBtn { width: 100%; padding: 14px; font-size: 15px; }
        .vlTyped { display: flex; gap: 8px; }
        .vlTyped input { flex: 1; border: 1px solid var(--line-strong, #e4e8f0); border-radius: 10px; padding: 11px 13px; font-size: 14px; }
        .vlTyped input:focus { outline: none; border-color: var(--navy, #1B2A4A); }
        .vlErr { background: var(--red-soft, #FBEAEA); color: var(--red, #A32D2D); border-radius: 8px; padding: 9px 12px; font-size: 13px; margin-top: 14px; }
        .vlLinks { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }
        .vlLink { background: none; border: none; font-size: 12.5px; color: var(--navy, #1B2A4A); text-decoration: underline; cursor: pointer; padding: 4px; }
        .vlLink.danger { color: var(--muted, #6b7688); }
        .vlFooter { font-size: 11.5px; color: var(--muted, #6b7688); line-height: 1.5; margin-top: 20px; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// Settings modal — set up, change, or turn off the passphrase. Opened
// from the sidebar, same pattern as the other account modals.
// ---------------------------------------------------------------------
export function VoiceLockSettings({ onClose }: { onClose: () => void }) {
  const [hasPhrase, setHasPhrase] = useState(false);
  const [recording, setRecording] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  useEffect(() => {
    setHasPhrase(!!localStorage.getItem(VOICE_HASH_KEY));
  }, []);

  function record() {
    setErr(null); setCaptured(null);
    const r = newRecognizer();
    if (!r) { setShowTyped(true); setErr("Voice recognition isn't supported in this browser — type a phrase instead."); return; }
    r.onresult = (e: any) => { setCaptured(e.results[0][0].transcript); setRecording(false); };
    r.onerror = (e: any) => { setErr(speechErrorMessage(e.error)); setRecording(false); };
    r.onend = () => setRecording(false);
    setRecording(true);
    r.start();
  }

  async function save(phrase: string) {
    if (!phrase.trim()) { setErr("Say or type a phrase first."); return; }
    const hash = await sha256Hex(normalize(phrase));
    localStorage.setItem(VOICE_HASH_KEY, hash);
    setHasPhrase(true);
    setCaptured(null); setTyped(""); setShowTyped(false);
    setMsg("Saved — this browser will ask for it next time the console loads.");
  }

  function turnOff() {
    if (!confirm("Turn off voice unlock for this browser?")) return;
    localStorage.removeItem(VOICE_HASH_KEY);
    setHasPhrase(false);
    setMsg("Voice unlock turned off for this browser.");
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="mh"><h3>Voice unlock</h3><button className="x" onClick={onClose}>✕</button></div>

        <p className="hint">
          A fun, on-brand extra step before the console loads, on this browser only — not a real
          security control. Your actual login stays your password and authenticator. Nothing is
          stored except a one-way hash; no audio or plain-text phrase is ever saved.
        </p>

        {msg && <div className="msg">{msg}</div>}
        {err && <div className="err">{err}</div>}

        {hasPhrase ? (
          <>
            <div className="status">🎙️ Voice unlock is on for this browser.</div>
            <button className="btn ghost small" type="button" onClick={turnOff}>Turn off</button>
            <button className="btn ghost small" type="button" onClick={() => { setHasPhrase(false); setMsg(null); }} style={{ marginLeft: 8 }}>
              Change phrase
            </button>
          </>
        ) : (
          <>
            <label>Choose a short phrase (3–6 words)</label>
            {!showTyped ? (
              <>
                <button className="btn ok" type="button" onClick={record} disabled={recording} style={{ width: "100%" }}>
                  {recording ? "Listening…" : "🎙️ Record phrase"}
                </button>
                {captured && (
                  <div className="captured">
                    <p>You said: <strong>"{captured}"</strong></p>
                    <div className="row2">
                      <button className="btn ghost" type="button" onClick={() => setCaptured(null)}>Retry</button>
                      <button className="btn ok" type="button" onClick={() => save(captured)}>Save this phrase</button>
                    </div>
                  </div>
                )}
                {!supported && <p className="hint" style={{ marginTop: 10 }}>Voice recognition isn't available in this browser (works in Chrome/Edge).</p>}
                <button className="vlLink" type="button" onClick={() => setShowTyped(true)}>Type it instead</button>
              </>
            ) : (
              <div className="typedRow">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. Suibing is my kingdom" />
                <button className="btn ok" type="button" onClick={() => save(typed)}>Save</button>
              </div>
            )}
          </>
        )}

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 60; }
          .modal { width: 100%; max-width: 440px; padding: 24px; }
          .mh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
          h3 { font-size: 18px; font-weight: 700; }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .hint { font-size: 12.5px; color: var(--ink-2); line-height: 1.6; margin-bottom: 16px; }
          .msg { font-size: 13px; color: var(--green); margin-bottom: 12px; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 12px; }
          .status { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 14px; }
          .btn.small { padding: 7px 12px; font-size: 12px; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 8px; }
          .captured { background: var(--navy-soft); border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 12px; font-size: 13px; }
          .row2 { display: flex; gap: 10px; margin-top: 10px; }
          .row2 .btn { flex: 1; }
          .typedRow { display: flex; gap: 8px; }
          .typedRow input { flex: 1; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 14px; }
          .vlLink { display: block; background: none; border: none; font-size: 12.5px; color: var(--navy); text-decoration: underline; cursor: pointer; padding: 8px 0 0; }
        `}</style>
      </div>
    </div>
  );
}
