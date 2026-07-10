'use client';

import React, { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [user, setUser] = useState<{ id: string; email: string; displayName: string; bio: string; role: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          setDisplayName(data.user.displayName || '');
          fetch(`/api/users/${data.user.id}`)
            .then((r) => r.json())
            .then((profile) => {
              setBio(profile.bio || '');
            });
        }
      });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, bio }),
    });
    setSaving(false);
    alert('Profile updated');
  };

  if (!user) return <div className="feed-empty">Loading profile...</div>;

  return (
    <div className="profile-page">
      <div className="feed-header"><h2>Profile</h2></div>
      <div className="profile-card">
        <div className="report-avatar profile-avatar">{displayName.charAt(0) || 'U'}</div>
        <form onSubmit={save}>
          <div className="form-group">
            <label>Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell your district about you..." />
          </div>
          <p className="profile-meta">Email: {user.email} · Role: {user.role}</p>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
        </form>
      </div>
    </div>
  );
}
