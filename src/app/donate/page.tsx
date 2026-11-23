'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DemoCheckout, postPayment } from '@/components/DemoCheckout';
import { DONATION_PRESETS_CENTS, MAX_DONATION_CENTS, MIN_DONATION_CENTS, formatUsd } from '@/lib/payments-demo';

/** Donations keep FixMyDistrict running (demo checkout: no real charge). */
export default function DonatePage() {
  const [amountCents, setAmountCents] = useState<number>(500);
  const [custom, setCustom] = useState('');
  const [thanks, setThanks] = useState<number | null>(null);

  const customCents = Math.round(Number(custom) * 100);
  const amount = custom ? customCents : amountCents;
  const amountValid = Number.isFinite(amount) && amount >= MIN_DONATION_CENTS && amount <= MAX_DONATION_CENTS;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        {thanks != null ? (
          <div role="status">
            <h2>Thank you!</h2>
            <p className="auth-subtitle">
              Your {formatUsd(thanks)} gift (demo) helps keep FixMyDistrict free to use, independent and ad-free. We never
              sell your data.
            </p>
            <Link href="/dashboard" className="btn-primary auth-btn">
              Back to posts
            </Link>
          </div>
        ) : (
          <>
            <h2>Support FixMyDistrict</h2>
            <p className="auth-subtitle">
              Donations pay for hosting, maps and moderation, so neighbours can keep holding local services to account.
              No data is ever sold.
            </p>
            <div className="donate-amounts" role="radiogroup" aria-label="Donation amount">
              {DONATION_PRESETS_CENTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  role="radio"
                  aria-checked={!custom && amountCents === cents}
                  className={`donate-amount ${!custom && amountCents === cents ? 'active' : ''}`}
                  onClick={() => {
                    setAmountCents(cents);
                    setCustom('');
                  }}
                >
                  {formatUsd(cents)}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label htmlFor="custom-amount">Other amount (USD)</label>
              <input
                id="custom-amount"
                inputMode="decimal"
                placeholder="e.g. 15"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ''))}
                aria-invalid={!!custom && !amountValid}
              />
              {custom && !amountValid && (
                <p className="field-error">
                  Enter between {formatUsd(MIN_DONATION_CENTS)} and {formatUsd(MAX_DONATION_CENTS)}
                </p>
              )}
            </div>
            <DemoCheckout
              amountCents={amountValid ? amount : MIN_DONATION_CENTS}
              buttonLabel={amountValid ? `Donate ${formatUsd(amount)}` : 'Choose an amount'}
              onPay={async (card) => {
                if (!amountValid) return { ok: false, error: 'Choose an amount first' };
                const result = await postPayment('/api/donate', { amountCents: amount, card });
                if (result.ok) setThanks(amount);
                return result;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
