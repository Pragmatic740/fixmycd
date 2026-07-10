'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { REPORT_STATUSES } from '../../../lib/categories';

interface QueueReport {
  id: string;
  referenceNo: string;
  title: string;
  status: string;
  severity: number;
  createdAt: string;
  submitterName: string | null;
}

export default function ReviewPage() {
  const [reports, setReports] = useState<QueueReport[]>([]);
  const [flags, setFlags] = useState<{ id: string; targetType: string; targetId: string; reason: string }[]>([]);

  useEffect(() => {
    fetch('/api/review/queue')
      .then((r) => r.json())
      .then((data) => {
        setReports(data.reports || []);
        setFlags(data.flags || []);
      });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const reviewNote = status === 'resubmit' ? prompt('Note for submitter:') : undefined;
    await fetch(`/api/review/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewNote }),
    });
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <div>
      <div className="feed-header"><h2>Review Queue</h2></div>

      {flags.length > 0 && (
        <section className="review-section">
          <h3>Pending Flags ({flags.length})</h3>
          {flags.map((f) => (
            <div key={f.id} className="review-item">
              <p>{f.targetType} · {f.reason}</p>
              {f.targetType === 'report' && (
                <Link href={`/dashboard/reports/${f.targetId}`}>View report</Link>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="review-section">
        <h3>Reports</h3>
        {reports.map((r) => (
          <div key={r.id} className="review-item">
            <Link href={`/dashboard/reports/${r.id}`}><strong>{r.title}</strong></Link>
            <p className="report-ref">{r.referenceNo} · {r.submitterName} · Severity {r.severity}</p>
            <div className="review-actions">
              {REPORT_STATUSES.map((s) => (
                <button key={s} className={`btn-sm ${r.status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateStatus(r.id, s)}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
