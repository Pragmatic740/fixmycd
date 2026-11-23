'use client';

import React from 'react';
import Link from 'next/link';
import { InstallButton } from '@/components/InstallButton';

export default function InstallPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '40px 20px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '60px', marginBottom: '16px' }}>📱</div>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 800,
              marginBottom: '12px',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Install FixMyDistrict
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: '460px',
              margin: '0 auto',
            }}
          >
            Add FixMyDistrict to your home screen for quick access and offline
            support.
          </p>
        </div>

        <InstallButton />

        {/* iOS */}
        <section
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            📱 iPhone / iPad
          </h2>
          <ol
            style={{
              paddingLeft: '20px',
              fontSize: '15px',
              lineHeight: 1.8,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            <li style={{ marginBottom: '8px' }}>
              Open this page in <strong style={{ color: 'var(--text-primary)' }}>Safari</strong>
            </li>
            <li style={{ marginBottom: '8px' }}>
              Tap the <strong style={{ color: 'var(--text-primary)' }}>Share</strong> button
              (square with arrow up)
            </li>
            <li style={{ marginBottom: '8px' }}>
              Scroll down and tap{' '}
              <strong style={{ color: 'var(--text-primary)' }}>&ldquo;Add to Home Screen&rdquo;</strong>
            </li>
            <li style={{ marginBottom: '8px' }}>
              Name it <strong style={{ color: 'var(--text-primary)' }}>FixMyDistrict</strong> and
              tap <strong style={{ color: 'var(--text-primary)' }}>Add</strong>
            </li>
          </ol>
        </section>

        {/* Android */}
        <section
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            🤖 Android
          </h2>
          <ol
            style={{
              paddingLeft: '20px',
              fontSize: '15px',
              lineHeight: 1.8,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            <li style={{ marginBottom: '8px' }}>
              Open this page in <strong style={{ color: 'var(--text-primary)' }}>Chrome</strong>
            </li>
            <li style={{ marginBottom: '8px' }}>
              Tap the <strong style={{ color: 'var(--text-primary)' }}>three-dot menu</strong> in
              the top right
            </li>
            <li style={{ marginBottom: '8px' }}>
              Tap{' '}
              <strong style={{ color: 'var(--text-primary)' }}>&ldquo;Install app&rdquo;</strong> or{' '}
              <strong style={{ color: 'var(--text-primary)' }}>&ldquo;Add to Home screen&rdquo;</strong>
            </li>
            <li style={{ marginBottom: '8px' }}>
              Confirm by tapping <strong style={{ color: 'var(--text-primary)' }}>Install</strong>
            </li>
          </ol>
        </section>

        {/* Desktop */}
        <section
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            💻 Desktop (Chrome / Edge)
          </h2>
          <ol
            style={{
              paddingLeft: '20px',
              fontSize: '15px',
              lineHeight: 1.8,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            <li style={{ marginBottom: '8px' }}>
              Open this page in{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Chrome</strong> or{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Edge</strong>
            </li>
            <li style={{ marginBottom: '8px' }}>
              Look for the{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Install</strong> icon in the
              address bar
            </li>
            <li style={{ marginBottom: '8px' }}>
              Click <strong style={{ color: 'var(--text-primary)' }}>Install</strong>
            </li>
          </ol>
        </section>

        {/* Why Install */}
        <section
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(109, 40, 217, 0.1))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              marginBottom: '12px',
              color: 'var(--text-primary)',
            }}
          >
            ✨ Why Install?
          </h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '15px',
              lineHeight: 1.8,
              color: 'var(--text-secondary)',
            }}
          >
            <li style={{ marginBottom: '8px' }}>
              ✅ <strong style={{ color: 'var(--text-primary)' }}>Full-screen</strong> — no
              browser bars
            </li>
            <li style={{ marginBottom: '8px' }}>
              ✅ <strong style={{ color: 'var(--text-primary)' }}>Home screen icon</strong> — like
              a native app
            </li>
            <li style={{ marginBottom: '8px' }}>
              ✅ <strong style={{ color: 'var(--text-primary)' }}>Works offline</strong> — for
              previously visited pages
            </li>
            <li style={{ marginBottom: '8px' }}>
              ✅ <strong style={{ color: 'var(--text-primary)' }}>Faster loading</strong> — cached
              assets
            </li>
            <li style={{ marginBottom: '8px' }}>
              ✅ <strong style={{ color: 'var(--text-primary)' }}>No app store</strong> — install
              directly
            </li>
          </ul>
        </section>

        {/* Back Link */}
        <div style={{ textAlign: 'center' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: '#ffffff',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}