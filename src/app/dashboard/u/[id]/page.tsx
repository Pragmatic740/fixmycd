'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCurrentUser } from '@/components/CurrentUserContext';
import { statusLabel } from '@/components/ReportFilters';
import { handleFor } from '@/lib/utils';

type Profile = {
  id: string;
  displayName: string | null;
  bio: string | null;
  role: string;
  reports: { id: string; title: string; status: string; createdAt: string }[];
};

export default function UserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useCurrentUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) setProfile(await r.json());
        else setNotFound(true);
      })
      .catch(() => !cancelled && setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/follows')
      .then((r) => (r.ok ? r.json() : []))
      .then((follows: { followType: string; targetId: string }[]) => {
        if (!cancelled) setFollowing(follows.some((f) => f.followType === 'user' && f.targetId === id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const toggleFollow = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/follows', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followType: 'user', targetId: id }),
      });
      if (res.ok) setFollowing(!following);
    } finally {
      setBusy(false);
    }
  };

  if (notFound) return <div className="feed-empty">This profile is not available.</div>;
  if (!profile) return <div className="feed-empty">Loading...</div>;

  const canFollow = !!user && user.id !== profile.id;

  return (
    <div className="profile-page">
      <div className="feed-header"><h2>{profile.displayName || 'Citizen'}</h2></div>
      <div className="profile-card">
        <div className="report-avatar profile-avatar">{profile.displayName?.charAt(0) || 'U'}</div>
        <p className="handle">@{handleFor(profile.displayName)}</p>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {canFollow && (
          <button className="btn-secondary btn-sm" onClick={toggleFollow} disabled={busy}>
            {following ? 'Unfollow' : 'Follow'}
          </button>
        )}
        <h3 style={{ marginTop: '24px' }}>Reports</h3>
        {profile.reports.length === 0 && <p className="report-ref">No reports yet.</p>}
        {profile.reports.map((r) => (
          <Link key={r.id} href={`/dashboard/reports/${r.id}`} className="profile-report-link">
            <span>{r.title}</span>
            <span className="report-ref">{statusLabel(r.status)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
