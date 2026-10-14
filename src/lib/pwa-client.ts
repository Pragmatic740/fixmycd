/**
 * Remove everything the service worker cached for this browser. Called on
 * logout so the next person on a shared device can't open the previous
 * user's pages offline.
 */
export async function clearOfflineCaches(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' });
  } catch {
    // Best effort: never block logout.
  }
}
