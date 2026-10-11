'use client';

import React, { useEffect, useState } from 'react';

interface Endorsement {
  id: string;
  expertUserId: string;
  severityLevel: number;
  note: string | null;
  createdAt: string;
  expertName: string | null;
}

interface EndorsementsSectionProps {
  reportId: string;
  isExpert: boolean;
}

export function EndorsementsSection({ reportId, isExpert }: EndorsementsSectionProps) {
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [severity, setSeverity] = useState(3);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEndorsements = () => {
    fetch(`/api/reports/${reportId}/endorsements`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) setEndorsements(data.items);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEndorsements();
  }, [reportId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/endorsements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severityLevel: severity, note }),
      });
      if (res.ok) {
        setShowForm(false);
        setNote('');
        setSeverity(3);
        fetchEndorsements();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit endorsement');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <section className="endorsements-section">
      <h3>
        Expert Endorsements ({endorsements.length})
        {endorsements.length > 0 && (
          <span className="endorsed-badge">✓ Endorsed</span>
        )}
      </h3>

      {endorsements.length === 0 ? (
        <p className="analytics-hint">No expert endorsements yet.</p>
      ) : (
        <div className="endorsement-list">
          {endorsements.map((e) => (
            <div key={e.id} className="endorsement-item">
              <div className="endorsement-header">
                <strong>{e.expertName || 'Expert'}</strong>
                <span
                  className={`sev-chip ${
                    e.severityLevel >= 4
                      ? 'sev-high'
                      : e.severityLevel === 3
                      ? 'sev-med'
                      : 'sev-low'
                  }`}
                >
                  Severity {e.severityLevel}
                </span>
                <span className="comment-time">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </div>
              {e.note && <p className="endorsement-note">{e.note}</p>}
            </div>
          ))}
        </div>
      )}

      {isExpert && !showForm && (
        <button className="btn-secondary btn-sm" onClick={() => setShowForm(true)}>
          Endorse this report
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="endorsement-form">
          <div className="form-group">
            <label>Severity Level</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add a brief note explaining your endorsement..."
            />
          </div>
          {error && <div className="comment-error">{error}</div>}
          <div className="endorsement-form-actions">
            <button type="submit" className="btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Endorsement'}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}