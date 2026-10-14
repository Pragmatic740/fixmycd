/** Callbacks passed to next/server `after()` during a test. */
export const pendingAfter: Array<() => unknown> = [];

/** Run (and clear) everything scheduled with after(). */
export async function flushAfter(): Promise<void> {
  while (pendingAfter.length) {
    const fn = pendingAfter.shift()!;
    await fn();
  }
}
