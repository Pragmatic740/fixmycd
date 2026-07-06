'use client';

import Link from 'next/link';
import React, { useState } from 'react';

// Reusable SVG Icons for the navigation
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ExploreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(1);
  const [latitude, setLatitude] = useState('-17.8292');
  const [longitude, setLongitude] = useState('31.0522');
  const [submitting, setSubmitting] = useState(false);

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toFixed(6));
          setLongitude(position.coords.longitude.toFixed(6));
        },
        (error) => {
          alert('Error obtaining geolocation. Please enter coordinates manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          severity,
        }),
      });

      if (response.ok) {
        // Reset form
        setTitle('');
        setDescription('');
        setSeverity(1);
        setIsModalOpen(false);
        // Refresh feed
        window.location.reload();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to submit report'}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Left Sidebar Navigation */}
      <aside className="app-sidebar">
        <Link href="/" className="app-sidebar-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        <nav className="app-nav">
          <Link href="/dashboard" className="app-nav-link active">
            <HomeIcon /> <span>Home</span>
          </Link>
          <Link href="/dashboard/explore" className="app-nav-link">
            <ExploreIcon /> <span>Explore</span>
          </Link>
          <Link href="/dashboard/notifications" className="app-nav-link">
            <BellIcon /> <span>Notifications</span>
          </Link>
          <Link href="/dashboard/profile" className="app-nav-link">
            <UserIcon /> <span>Profile</span>
          </Link>
        </nav>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          Report Issue
        </button>
      </aside>
      
      {/* Main Feed Content */}
      <main className="app-main">
        {children}
      </main>
      
      {/* Right Sidebar (Trending) */}
      <aside className="app-right-sidebar">
        <div className="trending-box">
          <h3>Trending in your District</h3>
          <div className="trending-item">
            <div className="trending-category">Potholes</div>
            <div className="trending-topic">Main Street crater reported by 12 people</div>
          </div>
          <div className="trending-item">
            <div className="trending-category">Street Lights</div>
            <div className="trending-topic">Oak Ave blackout entering day 3</div>
          </div>
          <div className="trending-item">
            <div className="trending-category">Water</div>
            <div className="trending-topic">Water main break resolved on 5th Ave</div>
          </div>
        </div>
      </aside>

      {/* Floating Action Button for Mobile */}
      <button className="fab" aria-label="Report Issue" onClick={() => setIsModalOpen(true)}>
        <PlusIcon />
      </button>

      {/* Report Issue Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Report Infrastructure Issue</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Issue Title</label>
                <input
                  type="text"
                  id="title"
                  placeholder="e.g. Broken streetlight on Oak Ave"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Detailed Description</label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Describe the failure, exact location details, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="severity">Severity Level (1-5)</label>
                  <select
                    id="severity"
                    value={severity}
                    onChange={(e) => setSeverity(parseInt(e.target.value))}
                  >
                    <option value="1">1 - Very Low</option>
                    <option value="2">2 - Low</option>
                    <option value="3">3 - Medium</option>
                    <option value="4">4 - High</option>
                    <option value="5">5 - Critical</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Geographic Coordinates</label>
                <div className="location-picker-row">
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', marginBottom: '2px' }}>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', marginBottom: '2px' }}>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      required
                    />
                  </div>
                  <button type="button" className="btn-detect" onClick={detectLocation}>
                    📍 Auto-Detect
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
