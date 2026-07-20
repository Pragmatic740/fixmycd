'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ReportListItem } from '../lib/types';
import ShareSheet from './ShareSheet';

const UpvoteIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function getStatusClass(status: string) {
  switch (status.toLowerCase().replace(' ', '_')) {
    case 'submitted': return 'submitted';
    case 'in_review': return 'in-review';
    case 'in_progress': return 'in-progress';
    case 'accepted': return 'accepted';
    case 'resolved': return 'resolved';
    default: return 'submitted';
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function severityLabel(severity: number | null) {
  if (!severity) return null;
  if (severity >= 4) return { label: 'Critical', className: 'sev-high' };
  if (severity === 3) return { label: 'Medium', className: 'sev-med' };
  return { label: 'Low', className: 'sev-low' };
}

interface ReportCardProps {
  report: ReportListItem;
  onUpvoteToggle?: (reportId: string, upvoted: boolean) => void;
  style?: React.CSSProperties;
}

export default function ReportCard({ report, onUpvoteToggle, style }: ReportCardProps) {
  const [bump, setBump] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const sev = severityLabel(report.severity);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const method = report.userHasUpvoted ? 'DELETE' : 'POST';
    const res = await fetch(`/api/reports/${report.id}/upvote`, { method });
    if (res.ok && onUpvoteToggle) {
      onUpvoteToggle(report.id, !report.userHasUpvoted);
      if (!report.userHasUpvoted) {
        setBump(true);
        setTimeout(() => setBump(false), 350);
      }
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShare((v) => !v);
  };

  return (
    <article className={`report-card ${report.featured ? 'report-card-featured' : ''}`} style={style}>
      <Link href={`/dashboard/u/${report.submitterId}`} className="report-avatar" onClick={(e) => e.stopPropagation()}>
        {report.userDisplayName ? report.userDisplayName.charAt(0).toUpperCase() : 'A'}
      </Link>

      <div className="report-card-body">
        <div className="report-card-header">
          <div className="report-user-info">
            <Link href={`/dashboard/u/${report.submitterId}`} className="display-name" onClick={(e) => e.stopPropagation()}>
              {report.userDisplayName || 'Anonymous'}
            </Link>
            <span className="handle">@{report.userEmail ? report.userEmail.split('@')[0] : 'citizen'}</span>
            <span className="dot-sep">·</span>
            <time className="report-timestamp" dateTime={report.createdAt}>
              {relativeTime(report.createdAt)}
            </time>
          </div>
        </div>

        <div className="report-meta-row">
          <span className={`report-badge ${getStatusClass(report.status)}`}>
            {report.status.replace(/_/g, ' ')}
          </span>
          {report.category && (
            <span className="report-category">
              {report.category}{report.subcategory ? ` · ${report.subcategory}` : ''}
            </span>
          )}
          {sev && <span className={`sev-chip ${sev.className}`}>{sev.label}</span>}
          {report.featured && <span className="featured-chip">Featured</span>}
        </div>

        <Link href={`/dashboard/reports/${report.id}`} className="report-content-link">
          <h3 className="report-title">{report.title}</h3>
          {report.description && (
            <p className="report-desc">
              {report.description.length > 220
                ? `${report.description.slice(0, 220)}…`
                : report.description}
            </p>
          )}
        </Link>

        {report.imageUrl && (
          <Link href={`/dashboard/reports/${report.id}`} className="report-image-link">
            <img src={report.imageUrl} alt="" className="report-image" loading="lazy" />
          </Link>
        )}

        <div className="report-actions">
          <button
            type="button"
            className={`action-btn action-upvote ${report.userHasUpvoted ? 'action-btn-active' : ''} ${bump ? 'action-bump' : ''}`}
            onClick={handleUpvote}
            aria-label="Upvote"
          >
            <UpvoteIcon filled={report.userHasUpvoted} />
            <span>{report.upvoteCount}</span>
          </button>
          <Link href={`/dashboard/reports/${report.id}`} className="action-btn action-comment">
            <CommentIcon />
            <span>{report.commentCount}</span>
          </Link>
          <button type="button" className="action-btn action-share" onClick={handleShare} aria-label="Share">
            <ShareIcon />
            <span>Share</span>
          </button>
        </div>
        {showShare && (
          <div className="report-share-panel" onClick={(e) => e.stopPropagation()}>
            <ShareSheet
              urlPath={`/r/${report.id}`}
              title={report.title}
              text={`Check out this FixMyDistrict report: ${report.title}`}
            />
          </div>
        )}
      </div>
    </article>
  );
}
