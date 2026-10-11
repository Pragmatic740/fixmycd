'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ShareSheet from '@/components/ShareSheet';
import { EndorsementsSection } from '@/components/reports/EndorsementsSection';
import { formatRelativeTime, handleFor } from '@/lib/utils';

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
  upvoteCount: number;
  commentCount: number;
  userHasUpvoted: boolean;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  userDisplayName: string | null;
}

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isExpert, setIsExpert] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setIsAuthenticated(!!data?.authenticated);
        const role = data?.user?.role;
        setIsExpert(role === 'referee' || role === 'admin' || role === 'super_admin');
      })
      .catch(() => setIsAuthenticated(false));

    Promise.all([
      fetch(`/api/reports/${id}`).then((r) => r.json()),
      fetch(`/api/reports/${id}/comments`).then((r) => r.json()),
    ])
      .then(([reportData, commentsData]) => {
        if (!reportData.error) setReport(reportData);
        if (Array.isArray(commentsData)) setComments(commentsData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleUpvote = async () => {
    if (!report) return;
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/dashboard/reports/${id}`;
      return;
    }
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
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/dashboard/reports/${id}`;
      return;
    }
    if (!newComment.trim()) {
      setCommentError('Comment cannot be empty');
      return;
    }
    setIsPosting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/reports/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments([
          {
            ...c,
            userDisplayName: 'You',
            createdAt: new Date().toISOString(),
          },
          ...comments,
        ]);
        setNewComment('');
        if (report) setReport({ ...report, commentCount: report.commentCount + 1 });
      } else {
        const data = await res.json();
        setCommentError(data.error || 'Failed to post comment');
      }
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsPosting(false);
    }
  };

  const flagReport = async () => {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/dashboard/reports/${id}`;
      return;
    }
    const reason = prompt('Why are you flagging this report?');
    if (!reason) return;
    await fetch(`/api/reports/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    alert('Report flagged for review.');
  };

  if (loading) {
    return (
      <div className="report-detail">
        <div className="feed-header">
          <div className="skeleton skeleton-title" />
        </div>
        <div className="report-card report-detail-card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-block" />
        </div>
      </div>
    );
  }

  if (!report) return <div className="feed-empty">Report not found.</div>;

  return (
    <div className="report-detail">
      <div className="feed-header">
        <Link href="/dashboard" className="back-link">
          &larr; Back to feed
        </Link>
        <h2>{report.title}</h2>
        <p className="report-ref">
          Ref: {report.referenceNo} · {report.status.replace('_', ' ')}
        </p>
      </div>

      <article className="report-card report-detail-card">
        <div className="report-card-header">
          <Link href={`/dashboard/u/${report.submitterId}`} className="report-avatar">
            {report.userDisplayName?.charAt(0) || 'A'}
          </Link>
          <div className="report-user-info">
            <span className="display-name">{report.userDisplayName}</span>
            <span className="handle">
              @{handleFor(report.userDisplayName)}
            </span>
          </div>
        </div>

        <div className="report-card-body">
          {report.category && (
            <p className="report-category">
              {report.category} · {report.subcategory} · {report.postAction}
            </p>
          )}
          <p className="report-desc">{report.description}</p>
          {report.aiSummary && (
            <p className="ai-summary">AI Summary: {report.aiSummary}</p>
          )}

          {report.imageUrl && (
            <img src={report.imageUrl} alt={report.title} className="report-image" />
          )}
          {report.videoUrl && (
            <video src={report.videoUrl} controls className="report-media" />
          )}
          {report.audioUrl && (
            <audio src={report.audioUrl} controls className="report-media" />
          )}

          <MiniMap latitude={report.latitude} longitude={report.longitude} />

          <div className="report-actions">
            {isAuthenticated ? (
              <button
                className={`action-btn ${
                  report.userHasUpvoted ? 'action-btn-active' : ''
                }`}
                onClick={toggleUpvote}
              >
                Upvote ({report.upvoteCount})
              </button>
            ) : (
              <span className="action-btn action-disabled" title="Sign in to upvote">
                Upvote ({report.upvoteCount})
              </span>
            )}
            {isAuthenticated ? (
              <button className="action-btn" onClick={flagReport}>
                Flag
              </button>
            ) : (
              <Link href={`/login?redirect=/dashboard/reports/${id}`} className="action-btn">
                Sign in to interact
              </Link>
            )}
            <a
              href={`/api/reports/${report.id}/pdf`}
              className="action-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 PDF
            </a>
          </div>
          <ShareSheet
            urlPath={`/r/${report.id}`}
            title={report.title}
            text={`Check out this FixMyDistrict report: ${report.title}`}
          />
          <p className="report-ref">
            Public link: <Link href={`/r/${report.id}`}>/r/{report.id}</Link>
          </p>
        </div>
      </article>

      <EndorsementsSection reportId={report.id} isExpert={isExpert} />

      <section className="comments-section">
        <h3>Comments ({report.commentCount})</h3>

        {isAuthenticated ? (
          <form onSubmit={submitComment} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              maxLength={1000}
              disabled={isPosting}
              aria-label="Comment text"
              rows={3}
            />
            <div className="comment-form-footer">
              <span className="comment-char-count">{newComment.length}/1000</span>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={isPosting || !newComment.trim()}
              >
                {isPosting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
            {commentError && (
              <div className="comment-error" role="alert">
                ⚠️ {commentError}
              </div>
            )}
          </form>
        ) : (
          <div className="comment-signin-prompt">
            <p>
              <Link href={`/login?redirect=/dashboard/reports/${id}`}>Sign in</Link> to
              leave a comment.
            </p>
          </div>
        )}

        {comments.length === 0 ? (
          <div className="comment-empty">
            <p>No comments yet — be the first</p>
          </div>
        ) : (
          <div className="comment-items">
            {comments.map((c) => (
              <div key={c.id} className="comment-item">
                <div className="comment-header">
                  <div className="comment-avatar">
                    {c.userDisplayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="comment-name">
                    {c.userDisplayName || 'Anonymous'}
                  </span>
                  <span className="comment-time">
                    {formatRelativeTime(c.createdAt)}
                  </span>
                </div>
                <div className="comment-body">{c.body}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}