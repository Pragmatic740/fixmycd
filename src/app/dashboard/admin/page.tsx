'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  disabledAt: string | null;
  isSynthetic?: boolean;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const role = data.user?.role;
        const ok = !!(data.authenticated && (role === 'admin' || role === 'super_admin'));
        setAuthorized(ok);
        setIsSuper(role === 'super_admin');
        if (ok) {
          return fetch('/api/admin/users')
            .then((r) => r.json())
            .then((list) => {
              if (Array.isArray(list)) setUsers(list);
              else setError(list.error || 'Failed to load users');
            });
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

  if (authorized === null) return <div className="feed-empty">Checking access…</div>;
  if (!authorized) {
    return (
      <div className="feed-empty">
        <h3>Admin only</h3>
        <p>Use admin@fixmydistrict.app or superadmin@fixmydistrict.app / password123</p>
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
        <Link href="/dashboard/admin/analytics" className="btn-primary btn-sm">Open Analytics</Link>
      </div>
      {error && <p className="analytics-error">{error}</p>}
      {users.map((u) => (
        <div key={u.id} className="review-item">
          <strong>{u.displayName || u.email}</strong>
          {u.isSynthetic && <span className="demo-badge">demo</span>}
          <p className="report-ref">{u.email} · {u.role} {u.disabledAt ? '(disabled)' : ''}</p>
          <div className="admin-user-actions">
            <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
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
    </div>
  );
}
