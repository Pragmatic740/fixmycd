'use client';

import { useEffect, useState } from 'react';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

/**
 * Registers the service worker (production only) and offers a reload when a
 * new version has been deployed, instead of silently mixing old and new code.
 */
export function PWARegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`, { scope: '/' })
      .then((registration) => {
        // Only prompt when replacing an existing worker, not on first install.
        const track = (worker: ServiceWorker | null) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
          });
        };
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        registration.addEventListener('updatefound', () => track(registration.installing));
      })
      .catch((error) => console.error('[PWA] Service Worker registration failed:', error));

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div className="pwa-update" role="status">
      A new version of FixMyDistrict is available.
      <button type="button" className="btn-primary btn-sm" onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>
        Reload
      </button>
    </div>
  );
}
