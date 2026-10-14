'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

function subscribeDisplayMode(onChange: () => void) {
  const mq = window.matchMedia?.('(display-mode: standalone)');
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

/**
 * One-tap install where the browser supports it (Chrome, Edge, Android);
 * other browsers fall back to the manual steps on the page.
 */
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Server render can't know; read display-mode on the client without a hydration mismatch.
  const runningInstalled = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const [justInstalled, setInstalled] = useState(false);
  const installed = runningInstalled || justInstalled;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="install-status">✅ FixMyDistrict is installed on this device.</p>;
  }
  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <div className="install-cta">
      <button type="button" className="btn-primary" onClick={() => void install()}>
        Install FixMyDistrict
      </button>
    </div>
  );
}
