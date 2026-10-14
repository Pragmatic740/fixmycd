'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/CurrentUserContext';

export default function ProfilePage() {
  const { user, loading, refresh } = useCurrentUser();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Fill the form once per signed-in user.
  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setDisplayName(user.displayName || '');
    setBio(user.bio || '');
    setEmailNotifications(user.emailNotifications !== false);
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio, emailNotifications }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ kind: 'ok', text: 'Profile updated' });
        await refresh();
      } else {
        const fieldMessage = data.fields ? Object.values(data.fields)[0] : null;
        setMessage({ kind: 'error', text: String(fieldMessage || data.error || 'Could not save your profile') });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="feed-empty">Loading profile...</div>;
  if (!user) return <div className="feed-empty">Please sign in to edit your profile.</div>;

  return (
    <div className="profile-page">
      <div className="feed-header"><h2>Profile</h2></div>
      <div className="profile-card">
        <div className="report-avatar profile-avatar">{displayName.charAt(0) || 'U'}</div>
        <form onSubmit={save}>
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input id="displayName" value={displayName} maxLength={80} required onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell your district about you..."
            />
          </div>
          <label className="filter-checkbox profile-toggle">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
            Email me when someone comments on, upvotes, endorses or updates my reports
          </label>
          <p className="profile-meta">Email: {user.email} · Role: {user.role.replace(/_/g, ' ')}</p>
          {message && (
            <p className={message.kind === 'ok' ? 'admin-notice' : 'field-error'} role="status">
              {message.text}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
        </form>
      </div>
    </div>
  );
}
