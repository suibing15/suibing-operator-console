"use client";
import { useEffect, useState } from "react";

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: any) {
      e.preventDefault();
      setPromptEvent(e);
    }
    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !promptEvent) return null;

  async function install() {
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  return (
    <button className="installBtn" onClick={install} type="button">
      ⬇ Install app
      <style jsx>{`
        .installBtn { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 7px 13px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .installBtn:hover { background: var(--navy); color: #fff; }
      `}</style>
    </button>
  );
}
