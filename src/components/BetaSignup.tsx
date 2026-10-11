'use client';

import React, { useState } from 'react';

/** "Tell me when it launches" form backed by /api/beta-subscribe. */
export default function BetaSignup() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/beta-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState('done');
        setMessage(data.message || "You're on the list!");
      } else {
        setState('error');
        setMessage(
          res.status === 429
            ? 'Too many attempts. Please try again later.'
            : data.fields?.email || data.error || 'Could not sign you up.'
        );
      }
    } catch {
      setState('error');
      setMessage('Could not sign you up. Check your connection.');
    }
  };

  return (
    <section className="beta-signup" aria-labelledby="beta-signup-title">
      <h2 id="beta-signup-title">Get notified when your district goes live</h2>
      {state === 'done' ? (
        <p role="status">{message}</p>
      ) : (
        <form onSubmit={submit} className="beta-signup-form">
          <input
            type="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            autoComplete="email"
          />
          <button type="submit" className="btn-primary btn-sm" disabled={state === 'sending'}>
            {state === 'sending' ? 'Signing up…' : 'Notify me'}
          </button>
          {state === 'error' && <p className="field-error">{message}</p>}
        </form>
      )}
    </section>
  );
}
