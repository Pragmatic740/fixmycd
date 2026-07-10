'use client';

import React from 'react';
import Link from 'next/link';
import type { ReportListItem } from '../lib/types';

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

interface ReportCardProps {
  report: ReportListItem;
  onUpvoteToggle?: (reportId: string, upvoted: boolean) => void;
}

export default function ReportCard({ report, onUpvoteToggle }: ReportCardProps) {
  const handleUpvote = async () => {
    const method = report.userHasUpvoted ? 'DELETE' : 'POST';
    const res = await fetch(`/api/reports/${report.id}/upvote`, { method });
    if (res.ok && onUpvoteToggle) {
      onUpvoteToggle(report.id, !report.userHasUpvoted);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/dashboard/reports/${report.id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard');
  };

  return (
    <article className="report-card">
      <div className="report-card-header">
        <Link href={`/dashboard/u/${report.submitterId}`} className="report-avatar">
          {report.userDisplayName ? report.userDisplayName.charAt(0) : 'A'}
        </Link>
        <div className="report-user-info">
          <Link href={`/dashboard/u/${report.submitterId}`} className="display-name">
            {report.userDisplayName || 'Anonymous'}
          </Link>{' '}
          <span className="handle">@{report.userEmail ? report.userEmail.split('@')[0] : 'citizen'}</span>
        </div>
        <div className="report-timestamp">
          {new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      </div>

      <div className="report-card-body">
        <div className="report-meta-row">
          <span className={`report-badge ${getStatusClass(report.status)}`}>{report.status.replace('_', ' ')}</span>
          {report.category && <span className="report-category">{report.category}{report.subcategory ? ` · ${report.subcategory}` : ''}</span>}
          <span className="report-ref">Ref: {report.referenceNo}</span>
        </div>

        <Link href={`/dashboard/reports/${report.id}`}>
          <h3 className="report-title">{report.title}</h3>
          <p className="report-desc">{report.description}</p>
        </Link>

        {report.imageUrl && (
          <Link href={`/dashboard/reports/${report.id}`} className="report-image-link">
            <img src={report.imageUrl} alt={report.title} className="report-image" />
          </Link>
        )}

        <div className="report-actions">
          <button
            className={`action-btn ${report.userHasUpvoted ? 'action-btn-active' : ''}`}
            onClick={handleUpvote}
          >
            <UpvoteIcon /> {report.upvoteCount}
          </button>
          <Link href={`/dashboard/reports/${report.id}`} className="action-btn">
            <CommentIcon /> {report.commentCount}
          </Link>
          <button className="action-btn" onClick={handleShare}>
            <ShareIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
