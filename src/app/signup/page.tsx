'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        // New accounts wait for an admin; there is no session yet.
        setPendingMessage(data.message || 'Your account is waiting for approval.');
      } else if (response.status === 429) {
        setError('Too many sign-up attempts. Please try again later.');
      } else {
        setFieldErrors(data.fields || {});
        setError(data.fields ? 'Please fix the highlighted fields.' : data.error || 'Failed to create account');
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

        {pendingMessage ? (
          <div className="auth-pending" role="status">
            <h2>Almost there</h2>
            <p className="auth-subtitle">{pendingMessage}</p>
            <p className="auth-subtitle">
              We&apos;ll email <strong>{email.trim().toLowerCase()}</strong> when an admin has reviewed your request.
              Meanwhile you can browse reports as a guest.
            </p>
            <Link href="/dashboard" className="btn-primary auth-btn">
              Browse reports
            </Link>
            <p className="auth-footer">
              Already approved? <Link href="/login">Log In</Link>
            </p>
          </div>
        ) : (
          <>
            <h2>Create your account</h2>
            <p className="auth-subtitle">Join the local community to report and track infrastructure issues</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSignup} noValidate>
              <div className="form-group">
                <label htmlFor="displayName">Full Name</label>
                <input
                  type="text"
                  id="displayName"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.displayName}
                  required
                />
                {fieldErrors.displayName && <p className="field-error">{fieldErrors.displayName}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email}
                  required
                />
                {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  required
                />
                {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
              </div>

              <button type="submit" className="btn-primary auth-btn" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <p className="auth-footer">
              Already have an account? <Link href="/login">Log In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
