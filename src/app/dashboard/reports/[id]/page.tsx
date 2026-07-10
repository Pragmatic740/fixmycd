'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const MiniMap = dynamic(() => import('../../../../components/MiniMap'), { ssr: false });

interface ReportDetail {
  id: string;
  referenceNo: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: number;
  status: string;
  category: string | null;
  subcategory: string | null;
  postAction: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  aiSummary: string | null;
  createdAt: string;
  submitterId: string;
  userDisplayName: string | null;
  userEmail: string | null;
  upvoteCount: number;
  commentCount: number;
  userHasUpvoted: boolean;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
}

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/reports/${id}`).then((r) => r.json()),
      fetch(`/api/reports/${id}/comments`).then((r) => r.json()),
    ]).then(([reportData, commentsData]) => {
      if (!reportData.error) setReport(reportData);
      if (Array.isArray(commentsData)) setComments(commentsData);
    }).finally(() => setLoading(false));
  }, [id]);

  const toggleUpvote = async () => {
    if (!report) return;
    const method = report.userHasUpvoted ? 'DELETE' : 'POST';
    const res = await fetch(`/api/reports/${id}/upvote`, { method });
    if (res.ok) {
      setReport({
        ...report,
        userHasUpvoted: !report.userHasUpvoted,
        upvoteCount: report.upvoteCount + (report.userHasUpvoted ? -1 : 1),
      });
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/reports/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments([{ ...c, userDisplayName: 'You', userEmail: null, createdAt: new Date().toISOString() }, ...comments]);
      setNewComment('');
      if (report) setReport({ ...report, commentCount: report.commentCount + 1 });
    }
  };

  const flagReport = async () => {
    const reason = prompt('Why are you flagging this report?');
    if (!reason) return;
    await fetch(`/api/reports/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    alert('Report flagged for review.');
  };

  if (loading) return <div className="feed-empty">Loading report...</div>;
  if (!report) return <div className="feed-empty">Report not found.</div>;

  return (
    <div className="report-detail">
      <div className="feed-header">
        <Link href="/dashboard" className="back-link">&larr; Back to feed</Link>
        <h2>{report.title}</h2>
        <p className="report-ref">Ref: {report.referenceNo} · {report.status.replace('_', ' ')}</p>
      </div>

      <article className="report-card report-detail-card">
        <div className="report-card-header">
          <Link href={`/dashboard/u/${report.submitterId}`} className="report-avatar">
            {report.userDisplayName?.charAt(0) || 'A'}
          </Link>
          <div className="report-user-info">
            <span className="display-name">{report.userDisplayName}</span>
            <span className="handle">@{report.userEmail?.split('@')[0]}</span>
          </div>
        </div>

        <div className="report-card-body">
          {report.category && <p className="report-category">{report.category} · {report.subcategory} · {report.postAction}</p>}
          <p className="report-desc">{report.description}</p>
          {report.aiSummary && <p className="ai-summary">AI Summary: {report.aiSummary}</p>}

          {report.imageUrl && <img src={report.imageUrl} alt={report.title} className="report-image" />}
          {report.videoUrl && <video src={report.videoUrl} controls className="report-media" />}
          {report.audioUrl && <audio src={report.audioUrl} controls className="report-media" />}

          <MiniMap latitude={report.latitude} longitude={report.longitude} />

          <div className="report-actions">
            <button className={`action-btn ${report.userHasUpvoted ? 'action-btn-active' : ''}`} onClick={toggleUpvote}>
              Upvote ({report.upvoteCount})
            </button>
            <button className="action-btn" onClick={() => navigator.clipboard.writeText(window.location.href)}>
              Copy link
            </button>
            <button className="action-btn" onClick={flagReport}>Flag</button>
          </div>
        </div>
      </article>

      <section className="comments-section">
        <h3>Comments ({report.commentCount})</h3>
        <form onSubmit={submitComment} className="comment-form">
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." rows={2} required />
          <button type="submit" className="btn-primary btn-sm">Post</button>
        </form>
        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <strong>{c.userDisplayName || 'User'}</strong>
            <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
            <p>{c.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
