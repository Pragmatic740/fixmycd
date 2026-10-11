'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = () =>
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) setUsers(list);
        else setError(list.error || 'Failed to load users');
      });

  const fetchPending = () =>
    fetch('/api/admin/users?status=pending')
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) setPendingUsers(list);
      });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const role = data.user?.role;
        const ok = !!(data.authenticated && (role === 'admin' || role === 'super_admin'));
        setAuthorized(ok);
        setIsSuper(role === 'super_admin');
        if (ok) {
          fetchAll();
          fetchPending();
        }
      })
      .catch(() => setAuthorized(false));
  }, []);

  const toggleDisable = async (userId: string, disabled: boolean) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, disabled }),
    });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, disabledAt: disabled ? new Date().toISOString() : null } : u
      )
    );
  };

  const changeRole = async (userId: string, role: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Role update failed');
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  };

  const handleApproval = async (userId: string, status: 'approved' | 'rejected') => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Status update failed');
      return;
    }
    fetchPending();
    fetchAll();
  };

  if (authorized === null) return <div className="feed-empty">Checking access…</div>;
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

  return (
    <div>
      <div className="feed-header">
        <h2>Admin — Users</h2>
        <Link href="/dashboard/admin/analytics" className="btn-primary btn-sm">
          Open Analytics
        </Link>
      </div>
      {error && <p className="analytics-error">{error}</p>}

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
                  <p className="report-ref">
                    Signed up: {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="pending-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleApproval(u.id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleApproval(u.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="all-users-section">
        <h3>All Users</h3>
        {users.map((u) => (
          <div key={u.id} className="review-item">
            <strong>{u.displayName || u.email}</strong>
            {u.isSynthetic && <span className="demo-badge">demo</span>}
            {u.status === 'pending' && <span className="demo-badge">pending</span>}
            <p className="report-ref">
              {u.email} · {u.role} {u.disabledAt ? '(disabled)' : ''}
            </p>
            <div className="admin-user-actions">
              <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary btn-sm"
                onClick={() => toggleDisable(u.id, !u.disabledAt)}
              >
                {u.disabledAt ? 'Enable' : 'Disable'}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}