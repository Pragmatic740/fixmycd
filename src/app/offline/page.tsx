import Link from 'next/link';

export const metadata = { title: 'Offline · FixMyDistrict' };

export default function OfflinePage() {
  return (
    <div className="auth-container">
      <div className="auth-card auth-pending">
        <h2>You&apos;re offline</h2>
        <p className="auth-subtitle">
          FixMyDistrict needs a connection to load reports and your account. Check your connection and try again.
        </p>
        <Link href="/dashboard" className="btn-primary auth-btn">
          Try again
        </Link>
      </div>
    </div>
  );
}
