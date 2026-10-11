'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TrendingSidebar from '../../components/TrendingSidebar';
import AdvancedReportForm from '../../components/reports/AdvancedReportForm';
import { CurrentUserProvider, isAdminRole, isModeratorRole, useCurrentUser } from '../../components/CurrentUserContext';
import { clearOfflineCaches } from '../../lib/pwa-client';
import { loginUrlFor } from '../../lib/redirect';
import { handleFor } from '../../lib/utils';

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
const LogInIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <DashboardShell>{children}</DashboardShell>
    </CurrentUserProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user: currentUser, loading: loadingUser } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const isAnalytics = pathname.startsWith('/dashboard/admin/analytics');
  const isAuthenticated = !!currentUser;
  // Don't flash the guest notice while the session is still loading.
  const isReadOnly = !loadingUser && !isAuthenticated;

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    fetch('/api/notifications?limit=1&unread=true')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser, pathname]);

  const navLink = (href: string, label: string, Icon: React.FC, badge?: number) => (
    <Link href={href} className={`app-nav-link ${pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? 'active' : ''}`}>
      <Icon /> <span>{label}</span>
      {badge ? <span className="nav-badge" aria-label={`${badge} unread`}>{badge > 99 ? '99+' : badge}</span> : null}
    </Link>
  );

  const isModerator = isModeratorRole(currentUser?.role);
  const isAdmin = isAdminRole(currentUser?.role);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await clearOfflineCaches();
    window.location.href = '/login';
  };

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
          {isAuthenticated && navLink('/dashboard/notifications', 'Notifications', BellIcon, unreadCount)}
          {isAuthenticated && navLink('/dashboard/profile', 'Profile', UserIcon)}
          {isModerator && navLink('/dashboard/review', 'Review', ExploreIcon)}
          {isAdmin && navLink('/dashboard/admin/analytics', 'Analytics', ChartIcon)}
          {isAdmin && navLink('/dashboard/admin', 'Admin', UserIcon)}
          {isAuthenticated ? (
            <button onClick={logout} className="app-nav-link nav-btn">
              <LogOutIcon /> <span>Log Out</span>
            </button>
          ) : loadingUser ? null : (
            <Link href={loginUrlFor(pathname)} className="app-nav-link">
              <LogInIcon /> <span>Sign In</span>
            </Link>
          )}
        </nav>

        {currentUser && (
          <div className="sidebar-user">
            <div className="report-avatar sidebar-avatar">
              {currentUser.displayName?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser.displayName}</div>
              <div className="sidebar-user-handle">
                @{handleFor(currentUser.displayName)} · {currentUser.role.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        )}

        {isAuthenticated && (
          <button className="btn-primary sidebar-report-btn" onClick={() => setIsModalOpen(true)}>
            Report Issue
          </button>
        )}
        <Link href="/install" className="pwa-install-link">
          📱 Install App
        </Link>
        {isReadOnly && (
          <div className="readonly-notice">
            <p>You&apos;re browsing as a guest. Sign in to post, comment, and upvote.</p>
            <Link href={loginUrlFor(pathname)} className="btn-primary sidebar-report-btn">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary sidebar-report-btn">
              Create Account
            </Link>
          </div>
        )}
      </aside>

      <main className={`app-main ${isAnalytics ? 'app-main-wide' : ''}`}>{children}</main>

      {!isAnalytics && (
        <aside className="app-right-sidebar">
          <TrendingSidebar />
        </aside>
      )}

      {isAuthenticated && (
        <button className="fab" aria-label="Report Issue" onClick={() => setIsModalOpen(true)}>
          <PlusIcon />
        </button>
      )}

      {isModalOpen && isAuthenticated && (
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