'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import ShareSheet from '@/components/ShareSheet';
import { EndorsementsSection } from '@/components/reports/EndorsementsSection';
import { formatRelativeTime, handleFor } from '@/lib/utils';
import { isAllowedMediaUrl } from '@/lib/media-url';
import { loginUrlFor } from '@/lib/redirect';
import { isModeratorRole, useCurrentUser } from '@/components/CurrentUserContext';

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
  userId?: string;
  userDisplayName: string | null;
}

export default function ReportDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const { user } = useCurrentUser();
  const isAuthenticated = !!user;
  const isExpert = isModeratorRole(user?.role);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [isPosting, setIsPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loading = loadState === 'loading';
  const loginHref = loginUrlFor(pathname || `/dashboard/reports/${id}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [reportRes, commentsRes] = await Promise.all([
          fetch(`/api/reports/${encodeURIComponent(id)}`),
          fetch(`/api/reports/${encodeURIComponent(id)}/comments`),
        ]);
        if (cancelled) return;
        if (reportRes.status === 404) {
          setLoadState('not-found');
          return;
        }
        if (!reportRes.ok) {
          setLoadState('error');
          return;
        }
        setReport(await reportRes.json());
        const commentsData = commentsRes.ok ? await commentsRes.json() : [];
        if (Array.isArray(commentsData)) setComments(commentsData);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleUpvote = async () => {
    if (!report) return;
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }
    const method = report.userHasUpvoted ? 'DELETE' : 'POST';
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/upvote`, { method });
    if (res.ok) {
      const data = await res.json();
      setReport({ ...report, userHasUpvoted: data.upvoted, upvoteCount: data.upvoteCount });
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }
    if (!newComment.trim()) {
      setCommentError('Comment cannot be empty');
      return;
    }
    setIsPosting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setComments([data as Comment, ...comments]);
        setNewComment('');
        if (report) setReport({ ...report, commentCount: report.commentCount + 1 });
      } else if (res.status === 429) {
        setCommentError('You are commenting too fast. Please wait a few minutes.');
      } else {
        setCommentError(data.fields?.body || data.error || 'Failed to post comment');
      }
    } catch {
      setCommentError('Failed to post comment. Check your connection.');
    } finally {
      setIsPosting(false);
    }
  };

  const flagReport = async () => {
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }
    const reason = prompt('Why are you flagging this report?');
    if (!reason?.trim()) return;
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim().slice(0, 500) }),
    });
    const data = await res.json().catch(() => ({}));
    setNotice(
      res.ok
        ? data.alreadyFlagged
          ? 'You already flagged this report; moderators will review it.'
          : 'Thanks — moderators will review this report.'
        : data.error || 'Could not flag this report.'
    );
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

  if (loadState === 'not-found' || (loadState === 'ready' && !report)) {
    return <div className="feed-empty">Report not found. It may have been removed by a moderator.</div>;
  }
  if (loadState === 'error' || !report) {
    return (
      <div className="feed-empty" role="alert">
        Could not load this report.{' '}
        <button className="btn-secondary btn-sm" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="report-detail">
      <div className="feed-header">
        <Link href="/dashboard" className="back-link">
          &larr; Back to feed
        </Link>
        <h2>{report.title}</h2>
        <p className="report-ref">
          Ref: {report.referenceNo} · {report.status.replace(/_/g, ' ')}
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
              {[report.category, report.subcategory, report.postAction].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="report-desc">{report.description}</p>
          {report.aiSummary && (
            <p className="ai-summary">AI Summary: {report.aiSummary}</p>
          )}

          {report.imageUrl && isAllowedMediaUrl(report.imageUrl, 'image') && (
            <img src={report.imageUrl} alt={report.title} className="report-image" referrerPolicy="no-referrer" />
          )}
          {report.videoUrl && isAllowedMediaUrl(report.videoUrl, 'video') && (
            <video src={report.videoUrl} controls className="report-media" />
          )}
          {report.audioUrl && isAllowedMediaUrl(report.audioUrl, 'audio') && (
            <audio src={report.audioUrl} controls className="report-media" />
          )}

          <MiniMap latitude={report.latitude} longitude={report.longitude} />

          <div className="report-actions">
            <button
              className={`action-btn ${report.userHasUpvoted ? 'action-btn-active' : ''}`}
              onClick={toggleUpvote}
              aria-pressed={report.userHasUpvoted}
              title={isAuthenticated ? undefined : 'Sign in to upvote'}
            >
              Upvote ({report.upvoteCount})
            </button>
            {isAuthenticated ? (
              <button className="action-btn" onClick={flagReport}>
                Flag
              </button>
            ) : (
              <Link href={loginHref} className="action-btn">
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
          {notice && <p className="admin-notice" role="status">{notice}</p>}
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
              <Link href={loginHref}>Sign in</Link> to
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
                  {c.userId ? (
                    <Link href={`/dashboard/u/${c.userId}`} className="comment-name">
                      {c.userId === user?.id ? 'You' : c.userDisplayName || 'Anonymous'}
                    </Link>
                  ) : (
                    <span className="comment-name">{c.userDisplayName || 'Anonymous'}</span>
                  )}
                  <time className="comment-time" dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
                    {formatRelativeTime(c.createdAt)}
                  </time>
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