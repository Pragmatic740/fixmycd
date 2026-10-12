'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface Endorsement {
  id: string;
  severityLevel: number;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
  expertName: string | null;
  expertRole: string | null;
  isMine: boolean;
}

interface EndorsementData {
  items: Endorsement[];
  count: number;
  averageSeverity: number | null;
  myEndorsement: Endorsement | null;
}

interface EndorsementsSectionProps {
  reportId: string;
  isExpert: boolean;
}

const ROLE_LABEL: Record<string, string> = { referee: 'Referee', admin: 'Admin', super_admin: 'Admin' };
const sevClass = (n: number) => (n >= 4 ? 'sev-high' : n === 3 ? 'sev-med' : 'sev-low');

export function EndorsementsSection({ reportId, isExpert }: EndorsementsSectionProps) {
  const [data, setData] = useState<EndorsementData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [severity, setSeverity] = useState(3);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/endorsements`);
    if (res.ok) setData(await res.json());
  }, [reportId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/${encodeURIComponent(reportId)}/endorsements`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const openForm = () => {
    // Editing: start from the expert's current endorsement.
    setSeverity(data?.myEndorsement?.severityLevel ?? 3);
    setNote(data?.myEndorsement?.note ?? '');
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/endorsements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severityLevel: severity, note }),
      });
      if (res.ok) {
        setShowForm(false);
        await load();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.fields ? String(Object.values(body.fields)[0]) : body.error || 'Failed to submit endorsement');
      }
    } catch {
      setError('Failed to submit. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remove your endorsement?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/endorsements`, { method: 'DELETE' });
      if (res.ok) {
        setShowForm(false);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) return null;
  const mine = data.myEndorsement;

  return (
    <section className="endorsements-section">
      <h3>
        Expert Endorsements ({data.count})
        {data.averageSeverity != null && (
          <span className={`sev-chip ${sevClass(Math.round(data.averageSeverity))}`} title="Average expert severity">
            Avg severity {data.averageSeverity}
          </span>
        )}
      </h3>

      {data.items.length === 0 ? (
        <p className="analytics-hint">No expert endorsements yet.</p>
      ) : (
        <div className="endorsement-list">
          {data.items.map((e) => (
            <div key={e.id} className={`endorsement-item ${e.isMine ? 'endorsement-mine' : ''}`}>
              <div className="endorsement-header">
                <strong>{e.isMine ? 'You' : e.expertName || 'Expert'}</strong>
                {e.expertRole && <span className="demo-badge">{ROLE_LABEL[e.expertRole] ?? 'Expert'}</span>}
                <span className={`sev-chip ${sevClass(e.severityLevel)}`}>Severity {e.severityLevel}</span>
                <span className="comment-time" title={new Date(e.updatedAt ?? e.createdAt).toLocaleString()}>
                  {formatRelativeTime(e.updatedAt ?? e.createdAt)}
                  {e.updatedAt ? ' (edited)' : ''}
                </span>
              </div>
              {e.note && <p className="endorsement-note">{e.note}</p>}
            </div>
          ))}
        </div>
      )}

      {isExpert && !showForm && (
        <div className="endorsement-form-actions">
          <button className="btn-secondary btn-sm" onClick={openForm}>
            {mine ? 'Edit my endorsement' : 'Endorse this report'}
          </button>
          {mine && (
            <button className="btn-secondary btn-sm" onClick={() => void remove()} disabled={submitting}>
              Remove
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="endorsement-form">
          <div className="form-group">
            <label htmlFor="endorse-severity">Severity Level</label>
            <select id="endorse-severity" value={severity} onChange={(e) => setSeverity(parseInt(e.target.value, 10))}>
              {[1, 2, 3, 4, 5].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="endorse-note">Note (optional)</label>
            <textarea
              id="endorse-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add a brief note explaining your endorsement..."
            />
            <span className="comment-char-count">{note.length}/500</span>
          </div>
          {error && <div className="comment-error" role="alert">{error}</div>}
          <div className="endorsement-form-actions">
            <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : mine ? 'Update Endorsement' : 'Submit Endorsement'}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
