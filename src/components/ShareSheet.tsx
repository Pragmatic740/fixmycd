'use client';

import React, { useState, useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

interface ShareSheetProps {
  urlPath: string;
  title: string;
  text?: string;
  compact?: boolean;
}

export default function ShareSheet({ urlPath, title, text, compact }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(!compact);
  // The origin is only known in the browser; the server renders the relative path.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => '');
  const absoluteUrl = `${origin}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;

  const body = text || title;
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${body}\n\n${absoluteUrl}`)}`;
  const sms = `sms:?&body=${encodeURIComponent(`${body} ${absoluteUrl}`)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: body, url: absoluteUrl });
        return;
      } catch {
        // cancelled
      }
    }
    await copy();
  };

  if (compact && !open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Share
      </button>
    );
  }

  return (
    <div className="share-sheet">
      <div className="share-sheet-actions">
        <button type="button" className="btn-secondary btn-sm" onClick={copy}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a className="btn-secondary btn-sm" href={mailto}>
          Email
        </a>
        <a className="btn-secondary btn-sm" href={sms}>
          Message
        </a>
        <button type="button" className="btn-primary btn-sm" onClick={nativeShare}>
          Share…
        </button>
      </div>
      <p className="share-sheet-url" title={absoluteUrl}>
        {absoluteUrl}
      </p>
    </div>
  );
}
