'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { CATEGORIES, POST_ACTIONS } from '../../lib/categories';
import TrendingSidebar from '../../components/TrendingSidebar';

const PinPickerMap = dynamic(() => import('../../components/PinPickerMap'), { ssr: false });

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const ExploreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);

interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(1);
  const [latitude, setLatitude] = useState(-17.8292);
  const [longitude, setLongitude] = useState(31.0522);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [postAction, setPostAction] = useState('failure');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setCurrentUser(data.user);
      })
      .finally(() => setLoadingUser(false));
  }, []);

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Upload failed');
      return null;
    }
    const data = await res.json();
    return data.url;
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));
    const url = await uploadFile(file);
    if (url) setImageUrl(url);
    setUploading(false);
  };

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file);
    if (url) {
      if (type === 'video') setVideoUrl(url);
      else setAudioUrl(url);
    }
    setUploading(false);
  };

  const detectLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
      },
      () => alert('Could not detect location.')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, latitude, longitude, severity, imageUrl, videoUrl, audioUrl,
          category, subcategory, postAction,
        }),
      });
      if (res.ok) {
        setTitle(''); setDescription(''); setSeverity(1); setCategory(''); setSubcategory('');
        setImageUrl(null); setImagePreview(null); setVideoUrl(null); setAudioUrl(null);
        setIsModalOpen(false);
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const navLink = (href: string, label: string, Icon: React.FC) => (
    <Link href={href} className={`app-nav-link ${pathname === href ? 'active' : ''}`}>
      <Icon /> <span>{label}</span>
    </Link>
  );

  const isModerator = currentUser?.role === 'referee' || currentUser?.role === 'admin';

  if (loadingUser) {
    return <div className="session-loading">Loading...</div>;
  }

  return (
    <div className="app-container">
      <aside className="app-sidebar">
        <Link href="/" className="app-sidebar-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        <nav className="app-nav">
          {navLink('/dashboard', 'Home', HomeIcon)}
          {navLink('/dashboard/explore', 'Explore', ExploreIcon)}
          {navLink('/dashboard/notifications', 'Notifications', BellIcon)}
          {navLink('/dashboard/profile', 'Profile', UserIcon)}
          {isModerator && navLink('/dashboard/review', 'Review', ExploreIcon)}
          {currentUser?.role === 'admin' && navLink('/dashboard/admin', 'Admin', UserIcon)}
          <button onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login'; })} className="app-nav-link nav-btn">
            <LogOutIcon /> <span>Log Out</span>
          </button>
        </nav>

        {currentUser && (
          <div className="sidebar-user">
            <div className="report-avatar sidebar-avatar">
              {currentUser.displayName?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser.displayName}</div>
              <div className="sidebar-user-handle">@{currentUser.email.split('@')[0]}</div>
            </div>
          </div>
        )}

        <button className="btn-primary sidebar-report-btn" onClick={() => setIsModalOpen(true)}>
          Report Issue
        </button>
      </aside>

      <main className="app-main">{children}</main>

      <aside className="app-right-sidebar">
        <TrendingSidebar />
      </aside>

      <button className="fab" aria-label="Report Issue" onClick={() => setIsModalOpen(true)}>
        <PlusIcon />
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content modal-content-wide">
            <div className="modal-header">
              <h3>Report Infrastructure Issue</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Issue Title</label>
                <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Broken streetlight on Oak Ave" />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the failure..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
                    <option value="">Select category</option>
                    {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subcategory</label>
                  <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
                    <option value="">Select subcategory</option>
                    {(category ? CATEGORIES[category] : []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Post Action</label>
                  <select value={postAction} onChange={(e) => setPostAction(e.target.value)}>
                    {POST_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Severity (1-5)</label>
                  <select value={severity} onChange={(e) => setSeverity(parseInt(e.target.value, 10))}>
                    {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Photo</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {imagePreview && <img src={imagePreview} alt="Preview" className="upload-preview" />}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Video (optional)</label>
                  <input type="file" accept="video/*" onChange={(e) => handleMediaChange(e, 'video')} />
                </div>
                <div className="form-group">
                  <label>Audio (optional)</label>
                  <input type="file" accept="audio/*" onChange={(e) => handleMediaChange(e, 'audio')} />
                </div>
              </div>
              <div className="form-group">
                <label>Location</label>
                <PinPickerMap latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
                <div className="location-picker-row">
                  <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(parseFloat(e.target.value))} />
                  <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(parseFloat(e.target.value))} />
                  <button type="button" className="btn-detect" onClick={detectLocation}>Use my location</button>
                </div>
              </div>
              <button type="submit" className="btn-primary btn-full" disabled={submitting || uploading}>
                {uploading ? 'Uploading...' : submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
