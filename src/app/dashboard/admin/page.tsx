'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { isAdminRole, useCurrentUser } from '@/components/CurrentUserContext';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  disabledAt: string | null;
  isSynthetic?: boolean;
  createdAt: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type BetaCounts = { total: number; waiting: number };

const ROLE_LABEL = (r: string) => r.replace(/_/g, ' ');

export default function AdminPage() {
  const { user: me, loading: loadingMe } = useCurrentUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [beta, setBeta] = useState<BetaCounts | null>(null);
  const [sendingBeta, setSendingBeta] = useState(false);

  const authorized = !!me && isAdminRole(me.role);
  const isSuper = me?.role === 'super_admin';

  const load = useCallback(async () => {
    const [allRes, pendingRes, betaRes] = await Promise.all([
      fetch(`/api/admin/users${statusFilter === 'all' ? '' : `?status=${statusFilter}`}`),
      fetch('/api/admin/users?status=pending'),
      fetch('/api/admin/beta-subscribers'),
    ]);
    if (allRes.ok) setUsers(await allRes.json());
    else setError('Failed to load users');
    if (pendingRes.ok) setPendingUsers(await pendingRes.json());
    if (betaRes.ok) setBeta(await betaRes.json());
  }, [statusFilter]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setError('Failed to load users');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorized, load]);

  /** PATCH one user; returns true when the server accepted the change. */
  const updateUser = async (userId: string, change: Record<string, unknown>, successNote: string) => {
    setBusyId(userId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...change }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Update failed');
        return false;
      }
      setNotice(successNote);
      await load();
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const decide = (u: AdminUser, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !confirm(`Reject ${u.displayName || u.email}? They will be told by email.`)) return;
    void updateUser(u.id, { status }, status === 'approved' ? 'Account approved — they have been emailed.' : 'Account rejected.');
  };

  const toggleDisable = (u: AdminUser) => {
    const disable = !u.disabledAt;
    if (disable && !confirm(`Disable ${u.displayName || u.email}? They will be signed out everywhere.`)) return;
    void updateUser(u.id, { disabled: disable }, disable ? 'Account disabled and signed out.' : 'Account enabled.');
  };

  const sendBeta = async () => {
    if (!beta?.waiting || !confirm(`Email ${beta.waiting} beta subscriber(s) that FixMyDistrict is open?`)) return;
    setSendingBeta(true);
    try {
      const res = await fetch('/api/admin/beta-subscribers', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBeta({ total: data.total, waiting: data.waiting });
        setNotice(`Sent ${data.sent} launch email(s)${data.failed ? `, ${data.failed} failed (check RESEND_API_KEY)` : ''}.`);
      } else {
        setError(data.error || 'Sending failed');
      }
    } finally {
      setSendingBeta(false);
    }
  };

  if (loadingMe) return <div className="feed-empty">Checking access…</div>;
  if (!authorized) {
    return (
      <div className="feed-empty">
        <h3>Admin only</h3>
        <p>Sign in with an admin account to manage users and moderation.</p>
      </div>
    );
  }

  const roleOptions = isSuper
    ? ['submitter', 'viewer', 'referee', 'admin', 'super_admin']
    : ['submitter', 'viewer', 'referee', 'admin'];
  // Admins manage regular accounts; only a super_admin manages admins. Nobody edits themself.
  const canManage = (u: AdminUser) => u.id !== me!.id && (isSuper || !isAdminRole(u.role));

  return (
    <div>
      <div className="feed-header">
        <h2>Admin — Users</h2>
        <Link href="/dashboard/admin/analytics" className="btn-primary btn-sm">
          Open Analytics
        </Link>
      </div>
      {error && <p className="analytics-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}

      <section className="pending-users-section">
        <h3>Pending Approvals ({pendingUsers.length})</h3>
        {pendingUsers.length === 0 ? (
          <p className="analytics-hint">No pending users.</p>
        ) : (
          <div className="pending-users">
            {pendingUsers.map((u) => (
              <div key={u.id} className="pending-user-card">
                <div>
                  <strong>{u.displayName || u.email}</strong>
                  <p className="report-ref">{u.email}</p>
                  <p className="report-ref">Signed up: {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="pending-actions">
                  <button className="btn-primary btn-sm" disabled={busyId === u.id} onClick={() => decide(u, 'approved')}>
                    {busyId === u.id ? 'Saving…' : 'Approve'}
                  </button>
                  <button className="btn-secondary btn-sm" disabled={busyId === u.id} onClick={() => decide(u, 'rejected')}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="all-users-section">
        <div className="admin-section-header">
          <h3>All Users</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {users.map((u) => (
          <div key={u.id} className="review-item">
            <strong>{u.displayName || u.email}</strong>
            {u.id === me!.id && <span className="demo-badge">you</span>}
            {u.isSynthetic && <span className="demo-badge">demo</span>}
            {u.status !== 'approved' && <span className={`demo-badge status-badge-${u.status}`}>{u.status}</span>}
            {u.disabledAt && <span className="demo-badge status-badge-rejected">disabled</span>}
            <p className="report-ref">
              {u.email} · {ROLE_LABEL(u.role)}
            </p>
            {canManage(u) && (
              <div className="admin-user-actions">
                <select
                  value={u.role}
                  disabled={busyId === u.id}
                  onChange={(e) => void updateUser(u.id, { role: e.target.value }, 'Role updated; the user was signed out to apply it.')}
                  aria-label={`Role for ${u.email}`}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL(r)}
                    </option>
                  ))}
                </select>
                {u.status !== 'approved' && (
                  <button className="btn-primary btn-sm" disabled={busyId === u.id} onClick={() => decide(u, 'approved')}>
                    Approve
                  </button>
                )}
                {u.status === 'approved' && (
                  <button className="btn-secondary btn-sm" disabled={busyId === u.id} onClick={() => decide(u, 'rejected')}>
                    Revoke approval
                  </button>
                )}
                <button className="btn-secondary btn-sm" disabled={busyId === u.id} onClick={() => toggleDisable(u)}>
                  {u.disabledAt ? 'Enable' : 'Disable'}
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {beta && (
        <section className="all-users-section">
          <h3>Beta waiting list</h3>
          <p className="analytics-hint">
            {beta.total} subscriber(s), {beta.waiting} not yet told about the launch.
          </p>
          <button className="btn-primary btn-sm" disabled={!beta.waiting || sendingBeta} onClick={() => void sendBeta()}>
            {sendingBeta ? 'Sending…' : 'Send launch email'}
          </button>
        </section>
      )}
    </div>
  );
}
