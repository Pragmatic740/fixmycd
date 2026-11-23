'use client';

import Link from 'next/link';
import { isAdminRole, isModeratorRole, useCurrentUser } from '@/components/CurrentUserContext';

type Section = { href: string; title: string; description: string };

/** Account hub: everything about your account in one place (also the menu on phones). */
export default function AccountPage() {
  const { user, loading } = useCurrentUser();
  if (loading) return <div className="feed-empty">Loading account…</div>;
  if (!user) return <div className="feed-empty">Please sign in to manage your account.</div>;

  const sections: Section[] = [
    { href: '/dashboard/account/profile', title: 'Profile', description: 'Your name, bio, email updates and appearance.' },
  ];
  sections.push({ href: '/donate', title: 'Donate', description: 'Help pay to run FixMyDistrict. No data is ever sold.' });
  if (isModeratorRole(user.role)) {
    sections.push({ href: '/dashboard/review', title: 'Review queue', description: 'Triage new and flagged posts.' });
  }
  if (isAdminRole(user.role)) {
    sections.push({
      href: '/dashboard/account/users',
      title: 'Users & approvals',
      description: 'Approve sign-ups, change roles, disable accounts and email the waiting list.',
    });
  }

  return (
    <div className="account-page">
      <div className="feed-header">
        <h2>Account</h2>
      </div>
      <ul className="account-sections">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="account-section-card">
              <strong>{s.title}</strong>
              <span>{s.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
