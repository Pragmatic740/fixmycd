'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeRedirect } from '@/lib/redirect';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Return to the page that sent the user here (same-site paths only).
        const target = safeRedirect(new URLSearchParams(window.location.search).get('redirect'));
        router.replace(target);
        router.refresh();
      } else if (response.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        <h2>Log in to your account</h2>
        <p className="auth-subtitle">Access your local feed and report issues</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn-primary auth-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account yet? <Link href="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
