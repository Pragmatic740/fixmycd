'use client';

import React, { useEffect, useState } from 'react';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  disabledAt: string | null;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then(setUsers);
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

  return (
    <div>
      <div className="feed-header"><h2>Admin — Users</h2></div>
      {users.map((u) => (
        <div key={u.id} className="review-item">
          <strong>{u.displayName || u.email}</strong>
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
