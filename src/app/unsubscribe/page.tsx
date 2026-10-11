'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * Landing page for the unsubscribe link in emails. It asks for a click
 * instead of unsubscribing on load, so link scanners in mail clients
 * can't turn notifications off by prefetching the URL.
 */
function UnsubscribeContent() {
  const params = useSearchParams();
  const u = params.get('u') || '';
  const t = params.get('t') || '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const confirmUnsubscribe = async () => {
    setState('working');
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ u, t }),
    }).catch(() => null);
    if (res?.ok) {
      setState('done');
    } else {
      const data = await res?.json().catch(() => null);
      setError(data?.error || 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-pending">
        <h2>Email notifications</h2>
        {!u || !t ? (
          <p className="auth-subtitle">This link is incomplete. You can manage emails from your profile settings.</p>
        ) : state === 'done' ? (
          <p className="auth-subtitle" role="status">
            You won&apos;t get activity emails any more. You can turn them back on in your profile.
          </p>
        ) : (
          <>
            <p className="auth-subtitle">Stop receiving emails about comments, upvotes and updates on your reports?</p>
            {state === 'error' && <div className="auth-error">{error}</div>}
            <button className="btn-primary auth-btn" onClick={() => void confirmUnsubscribe()} disabled={state === 'working'}>
              {state === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}
            </button>
          </>
        )}
        <p className="auth-footer">
          <Link href="/dashboard/profile">Profile settings</Link>
        </p>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="feed-empty">Loading…</div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
