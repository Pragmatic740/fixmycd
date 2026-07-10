'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function UserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [profile, setProfile] = useState<{
    displayName: string;
    email: string;
    bio: string | null;
    reports: { id: string; title: string; status: string; createdAt: string }[];
  } | null>(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then(setProfile);
    fetch('/api/follows')
      .then((r) => r.json())
      .then((follows: { followType: string; targetId: string }[]) => {
        setFollowing(follows.some((f) => f.followType === 'user' && f.targetId === id));
      });
  }, [id]);

  const toggleFollow = async () => {
    const method = following ? 'DELETE' : 'POST';
    await fetch('/api/follows', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followType: 'user', targetId: id }),
    });
    setFollowing(!following);
  };

  if (!profile) return <div className="feed-empty">Loading...</div>;

  return (
    <div className="profile-page">
      <div className="feed-header"><h2>{profile.displayName}</h2></div>
      <div className="profile-card">
        <div className="report-avatar profile-avatar">{profile.displayName?.charAt(0) || 'U'}</div>
        <p className="handle">@{profile.email.split('@')[0]}</p>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <button className="btn-secondary btn-sm" onClick={toggleFollow}>
          {following ? 'Unfollow' : 'Follow'}
        </button>
        <h3 style={{ marginTop: '24px' }}>Reports</h3>
        {profile.reports.map((r) => (
          <Link key={r.id} href={`/dashboard/reports/${r.id}`} className="profile-report-link">
            <span>{r.title}</span>
            <span className="report-ref">{r.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
