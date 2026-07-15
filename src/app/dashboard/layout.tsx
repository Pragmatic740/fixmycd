'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TrendingSidebar from '../../components/TrendingSidebar';
import AdvancedReportForm from '../../components/reports/AdvancedReportForm';

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const ExploreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14v4M12 10v8M17 6v12"/></svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);

interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const isAnalytics = pathname.startsWith('/dashboard/admin/analytics');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setCurrentUser(data.user);
      })
      .finally(() => setLoadingUser(false));
  }, []);

  const navLink = (href: string, label: string, Icon: React.FC) => (
    <Link href={href} className={`app-nav-link ${pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? 'active' : ''}`}>
      <Icon /> <span>{label}</span>
    </Link>
  );

  const isModerator = currentUser?.role === 'referee' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  if (loadingUser) {
    return <div className="session-loading">Loading...</div>;
  }

  return (
    <div className={`app-container ${isAnalytics ? 'analytics-mode' : ''}`}>
      <aside className="app-sidebar">
        <Link href="/" className="app-sidebar-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        <nav className="app-nav">
          {navLink('/dashboard', 'Home', HomeIcon)}
          {navLink('/dashboard/explore', 'Explore', ExploreIcon)}
          {navLink('/dashboard/notifications', 'Notifications', BellIcon)}
          {navLink('/dashboard/profile', 'Profile', UserIcon)}
          {isModerator && navLink('/dashboard/review', 'Review', ExploreIcon)}
          {isAdmin && navLink('/dashboard/admin/analytics', 'Analytics', ChartIcon)}
          {isAdmin && navLink('/dashboard/admin', 'Admin', UserIcon)}
          <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; })} className="app-nav-link nav-btn">
            <LogOutIcon /> <span>Log Out</span>
          </button>
        </nav>

        {currentUser && (
          <div className="sidebar-user">
            <div className="report-avatar sidebar-avatar">
              {currentUser.displayName?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser.displayName}</div>
              <div className="sidebar-user-handle">@{currentUser.email.split('@')[0]} · {currentUser.role}</div>
            </div>
          </div>
        )}

        <button className="btn-primary sidebar-report-btn" onClick={() => setIsModalOpen(true)}>
          Report Issue
        </button>
      </aside>

      <main className={`app-main ${isAnalytics ? 'app-main-wide' : ''}`}>{children}</main>

      {!isAnalytics && (
        <aside className="app-right-sidebar">
          <TrendingSidebar />
        </aside>
      )}

      <button className="fab" aria-label="Report Issue" onClick={() => setIsModalOpen(true)}>
        <PlusIcon />
      </button>

      {isModalOpen && (
        <AdvancedReportForm
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
