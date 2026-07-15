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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const ok = !!(data.authenticated && data.user?.role === 'admin');
        setAuthorized(ok);
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

  if (authorized === null) return <div className="feed-empty">Checking access…</div>;
  if (!authorized) {
    return (
      <div className="feed-empty">
        <h3>Admin only</h3>
        <p>Use admin@fixmydistrict.app / password123</p>
      </div>
    );
  }

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
          <button
            className="btn-secondary btn-sm"
            onClick={() => toggleDisable(u.id, !u.disabledAt)}
          >
            {u.disabledAt ? 'Enable' : 'Disable'}
          </button>
        </div>
      ))}
    </div>
  );
}
