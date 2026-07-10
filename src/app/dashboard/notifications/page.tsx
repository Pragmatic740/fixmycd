'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  reportId: string | null;
  actorDisplayName: string | null;
  reportTitle: string | null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then(setItems);
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div>
      <div className="feed-header">
        <h2>Notifications</h2>
        {items.length > 0 && (
          <button className="btn-secondary btn-sm" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="feed-empty">No notifications yet.</div>
      ) : (
        items.map((n) => (
          <div key={n.id} className={`notification-item ${n.read ? '' : 'notification-unread'}`}>
            <p>
              <strong>{n.actorDisplayName || 'Someone'}</strong>{' '}
              {n.type === 'upvote' ? 'upvoted' : 'commented on'}{' '}
              {n.reportId ? (
                <Link href={`/dashboard/reports/${n.reportId}`}>{n.reportTitle || 'your report'}</Link>
              ) : 'your activity'}
            </p>
            <span className="comment-date">{new Date(n.createdAt).toLocaleString()}</span>
          </div>
        ))
      )}
    </div>
  );
}
