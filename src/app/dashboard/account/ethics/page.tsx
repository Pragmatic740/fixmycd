'use client';

import React, { useEffect, useState } from 'react';
import { EthicsText } from '@/components/EthicsText';
import { isAdminRole, useCurrentUser } from '@/components/CurrentUserContext';
import { MAX_ETHICS_LENGTH } from '@/lib/ethics-text';

type Ethics = { version: number; body: string; publishedAt: string | null };

/** Everyone can read the Code of Ethics here; admins can edit and publish a new version. */
export default function AccountEthicsPage() {
  const { user } = useCurrentUser();
  const admin = isAdminRole(user?.role);
  const [ethics, setEthics] = useState<Ethics | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/ethics')
      .then((r) => r.json())
      .then((data: Ethics) => {
        setEthics(data);
        setDraft(data.body);
      })
      .catch(() => setMessage({ kind: 'error', text: 'Could not load the Code of Ethics.' }));
  }, []);

  const publish = async () => {
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/admin/ethics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEthics(data);
      setEditing(false);
      setMessage({ kind: 'ok', text: `Published version ${data.version}. New members will agree to this version.` });
    } else {
      setMessage({ kind: 'error', text: data.fields?.body || data.error || 'Could not publish.' });
    }
    setSaving(false);
  };

  return (
    <div className="ethics-admin">
      <div className="feed-header admin-section-header">
        <h2>Code of Ethics</h2>
        {admin && ethics && !editing && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <div className="ethics-admin-body">
        {message && (
          <p className={message.kind === 'ok' ? 'admin-notice' : 'field-error'} role="status">
            {message.text}
          </p>
        )}
        {!ethics ? (
          <p className="analytics-hint">Loading…</p>
        ) : editing ? (
          <>
            <p className="analytics-hint">
              Plain text. Start a line with <code># </code> for a heading and <code>- </code> for a bullet; leave a blank
              line between paragraphs. Publishing creates version {ethics.version + 1} and is recorded in the audit log.
            </p>
            <label htmlFor="ethics-draft" className="visually-hidden">
              Code of Ethics text
            </label>
            <textarea
              id="ethics-draft"
              className="ethics-editor"
              value={draft}
              maxLength={MAX_ETHICS_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
            />
            <div className="ethics-actions">
              <button type="button" className="btn-primary btn-sm" onClick={publish} disabled={saving || draft.trim() === ethics.body.trim()}>
                {saving ? 'Publishing…' : `Publish version ${ethics.version + 1}`}
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setDraft(ethics.body);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
            <h3 className="ethics-preview-title">Preview</h3>
            <EthicsText body={draft} />
          </>
        ) : (
          <>
            <EthicsText body={ethics.body} />
            <p className="ethics-version">Version {ethics.version}</p>
          </>
        )}
      </div>
    </div>
  );
}
