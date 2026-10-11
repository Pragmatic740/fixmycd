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
  const [loading, setLoading] = useState(true);

  const fetchItems = () => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) setItems(data.items);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getMessage = (n: Notification) => {
    const actor = <strong>{n.actorDisplayName || 'Someone'}</strong>;
    const reportLink = n.reportId ? (
      <Link href={`/dashboard/reports/${n.reportId}`}>
        {n.reportTitle || 'your report'}
      </Link>
    ) : (
      'your report'
    );

    switch (n.type) {
      case 'upvote':
        return <>{actor} upvoted {reportLink}</>;
      case 'comment':
        return <>{actor} commented on {reportLink}</>;
      case 'status_change':
        return <>Status changed on {reportLink}</>;
      default:
        return <>{actor} interacted with {reportLink}</>;
    }
  };

  if (loading) return <div className="feed-empty">Loading...</div>;

  return (
    <div>
      <div className="feed-header">
        <h2>Notifications</h2>
        {items.length > 0 && (
          <button className="btn-secondary btn-sm" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="feed-empty">No notifications yet.</div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={`notification-item ${n.read ? '' : 'notification-unread'}`}
          >
            <p>{getMessage(n)}</p>
            <span className="comment-date">
              {new Date(n.createdAt).toLocaleString()}
            </span>
          </div>
        ))
      )}
    </div>
  );
}