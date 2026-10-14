'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  reportId: string | null;
  actorDisplayName: string | null;
  reportTitle: string | null;
  metadata: { from?: string; to?: string; severityLevel?: number } | null;
}

interface Page {
  items: Notification[];
  unreadCount: number;
  nextBefore: string | null;
}

const label = (s?: string) => (s ? s.replace(/_/g, ' ') : '');

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (before?: string | null): Promise<Page | null> => {
    const qs = new URLSearchParams({ limit: '30' });
    if (before) qs.set('before', before);
    const res = await fetch(`/api/notifications?${qs}`);
    return res.ok ? res.json() : null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await fetchPage().catch(() => null);
      if (cancelled) return;
      if (!page) {
        setState('error');
        return;
      }
      setItems(page.items);
      setNextBefore(page.nextBefore);
      setUnreadCount(page.unreadCount);
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextBefore);
      if (page) {
        setItems((prev) => [...prev, ...page.items]);
        setNextBefore(page.nextBefore);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const markRead = (ids: string[] | 'all') => {
    void fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids === 'all' ? { markAllRead: true } : { ids }),
    });
    setItems((prev) => prev.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnreadCount((c) => (ids === 'all' ? 0 : Math.max(0, c - ids.length)));
  };

  const getMessage = (n: Notification) => {
    const actor = <strong>{n.actorDisplayName || 'Someone'}</strong>;
    const report = n.reportTitle || 'your report';

    switch (n.type) {
      case 'upvote':
        return <>{actor} upvoted <em>{report}</em></>;
      case 'comment':
        return <>{actor} commented on <em>{report}</em></>;
      case 'endorsement':
        return (
          <>
            {actor} endorsed <em>{report}</em>
            {n.metadata?.severityLevel ? <> at severity {n.metadata.severityLevel}/5</> : null}
          </>
        );
      case 'status_change':
        return n.metadata?.to ? (
          <>
            <em>{report}</em> moved from {label(n.metadata.from)} to <strong>{label(n.metadata.to)}</strong>
          </>
        ) : (
          <>Status changed on <em>{report}</em></>
        );
      default:
        return <>{actor} interacted with <em>{report}</em></>;
    }
  };

  if (state === 'loading') return <div className="feed-empty">Loading...</div>;
  if (state === 'error') {
    return (
      <div className="feed-empty" role="alert">
        Could not load notifications.{' '}
        <button className="btn-secondary btn-sm" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="feed-header">
        <h2>Notifications{unreadCount ? ` (${unreadCount})` : ''}</h2>
        {unreadCount > 0 && (
          <button className="btn-secondary btn-sm" onClick={() => markRead('all')}>
            Mark all read
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="feed-empty">No notifications yet.</div>
      ) : (
        items.map((n) => {
          const body = (
            <>
              <p>{getMessage(n)}</p>
              <time className="comment-date" dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString()}>
                {formatRelativeTime(n.createdAt)}
              </time>
            </>
          );
          return n.reportId ? (
            <Link
              key={n.id}
              href={`/dashboard/reports/${n.reportId}`}
              className={`notification-item ${n.read ? '' : 'notification-unread'}`}
              onClick={() => !n.read && markRead([n.id])}
            >
              {body}
            </Link>
          ) : (
            <div key={n.id} className={`notification-item ${n.read ? '' : 'notification-unread'}`}>
              {body}
            </div>
          );
        })
      )}
      {nextBefore && (
        <button className="btn-secondary load-more-btn" onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Show older'}
        </button>
      )}
    </div>
  );
}
