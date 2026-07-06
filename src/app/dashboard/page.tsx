'use client';

import React, { useEffect, useState } from 'react';

// Action Bar Icons
const UpvoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
);

const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>
  </svg>
);

interface Report {
  id: string;
  referenceNo: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: number;
  status: string;
  imageUrl: string | null;
  createdAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
}

// Haversine formula to calculate distance in km between two coordinates
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<'local' | 'global'>('global');
  
  // Geolocation states (defaulting to seed coordinates in Harare, Zimbabwe)
  const [userCoords, setUserCoords] = useState({ latitude: -17.8292, longitude: 31.0522 });

  useEffect(() => {
    // Attempt to get user's browser location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          console.log('Using default seed coordinates for local feed.');
        }
      );
    }
  }, []);

  useEffect(() => {
    async function fetchReports() {
      try {
        const response = await fetch('/api/reports');
        if (response.ok) {
          const data = await response.json();
          setReports(data);
        }
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  useEffect(() => {
    if (feedType === 'global') {
      setFilteredReports(reports);
    } else {
      // Filter reports within a 2.5km radius of userCoords
      const local = reports.filter((report) => {
        const distance = getDistance(
          userCoords.latitude,
          userCoords.longitude,
          report.latitude,
          report.longitude
        );
        return distance <= 2.5;
      });
      setFilteredReports(local);
    }
  }, [reports, feedType, userCoords]);

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted':
        return 'submitted';
      case 'in review':
      case 'review':
        return 'in-review';
      case 'in progress':
        return 'in-progress';
      case 'resolved':
        return 'resolved';
      default:
        return 'submitted';
    }
  };

  return (
    <>
      <div className="feed-header" style={{ paddingBottom: '0' }}>
        <h2>Feed</h2>
        <div className="feed-tabs" style={{ marginTop: '12px' }}>
          <button
            className={`feed-tab ${feedType === 'global' ? 'active' : ''}`}
            onClick={() => setFeedType('global')}
          >
            Global Feed
          </button>
          <button
            className={`feed-tab ${feedType === 'local' ? 'active' : ''}`}
            onClick={() => setFeedType('local')}
          >
            Local (2.5km)
          </button>
        </div>
      </div>
      
      <div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading feed...
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {feedType === 'local' 
              ? 'No reports within 2.5km of your location. Try switching to Global Feed!' 
              : 'No reports in the database yet.'}
          </div>
        ) : (
          filteredReports.map(report => (
            <article key={report.id} className="report-card">
              <div className="report-card-header">
                <div className="report-avatar">
                  {report.userDisplayName ? report.userDisplayName.charAt(0) : 'A'}
                </div>
                <div className="report-user-info">
                  <span className="display-name">{report.userDisplayName || 'Anonymous'}</span>{' '}
                  <span className="handle">@{report.userEmail ? report.userEmail.split('@')[0] : 'citizen'}</span>
                </div>
                <div className="report-timestamp">
                  {new Date(report.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
              
              <div style={{ paddingLeft: '52px' }}>
                <div>
                  <span className={`report-badge ${getStatusClass(report.status)}`}>
                    {report.status}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                    Ref: {report.referenceNo}
                  </span>
                  <span className="report-category" style={{ fontSize: '11px' }}>
                    📍 {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                  </span>
                </div>
                
                <h3 className="report-title">{report.title}</h3>
                <p className="report-desc">{report.description}</p>

                {report.imageUrl && (
                  <div style={{ marginTop: '12px', marginBottom: '12px', overflow: 'hidden', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <img 
                      src={report.imageUrl} 
                      alt={report.title} 
                      style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} 
                    />
                  </div>
                )}
                
                <div className="report-actions">
                  <button className="action-btn">
                    <UpvoteIcon /> {Math.floor(Math.random() * 50)}
                  </button>
                  <button className="action-btn">
                    <CommentIcon /> {Math.floor(Math.random() * 15)}
                  </button>
                  <button className="action-btn">
                    <ShareIcon />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
