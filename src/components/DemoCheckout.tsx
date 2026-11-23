'use client';

import React, { useState } from 'react';
import { formatUsd, type CardErrors } from '@/lib/payments-demo';

export type DemoCard = { number: string; expiry: string; cvc: string; name: string };
export type CheckoutResult = { ok: true } | { ok: false; error: string; fields?: CardErrors };

/**
 * Card form for the demo checkout. It is clearly labelled as a demo, and the card
 * details only go to our own API (which keeps the last 4 digits, never the number or CVC).
 */
export function DemoCheckout({
  amountCents,
  buttonLabel,
  onPay,
}: {
  amountCents: number;
  buttonLabel?: string;
  onPay: (card: DemoCard) => Promise<CheckoutResult>;
}) {
  const [card, setCard] = useState<DemoCard>({ number: '', expiry: '', cvc: '', name: '' });
  const [errors, setErrors] = useState<CardErrors>({});
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const set = (key: keyof DemoCard) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCard((c) => ({ ...c, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaying(true);
    setError('');
    setErrors({});
    const result: CheckoutResult = await onPay(card).catch(() => ({ ok: false, error: 'Payment failed. Please try again.' }));
    if (!result.ok) {
      setError(result.error);
      setErrors(result.fields ?? {});
    }
    setPaying(false);
  };

  return (
    <form className="demo-checkout" onSubmit={submit} noValidate>
      <p className="demo-checkout-banner" role="note">
        <strong>Demo — no real charge.</strong> Use the test card <code>4242 4242 4242 4242</code>, any future expiry
        and any CVC.
      </p>
      {error && <div className="auth-error">{error}</div>}
      <div className="form-group">
        <label htmlFor="card-name">Name on card</label>
        <input id="card-name" value={card.name} onChange={set('name')} autoComplete="cc-name" aria-invalid={!!errors.name} maxLength={100} />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>
      <div className="form-group">
        <label htmlFor="card-number">Card number</label>
        <input
          id="card-number"
          value={card.number}
          onChange={set('number')}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          aria-invalid={!!errors.number}
          maxLength={23}
        />
        {errors.number && <p className="field-error">{errors.number}</p>}
      </div>
      <div className="demo-checkout-row">
        <div className="form-group">
          <label htmlFor="card-expiry">Expiry</label>
          <input id="card-expiry" value={card.expiry} onChange={set('expiry')} autoComplete="cc-exp" placeholder="MM/YY" aria-invalid={!!errors.expiry} maxLength={7} />
          {errors.expiry && <p className="field-error">{errors.expiry}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="card-cvc">CVC</label>
          <input id="card-cvc" value={card.cvc} onChange={set('cvc')} inputMode="numeric" autoComplete="cc-csc" placeholder="123" aria-invalid={!!errors.cvc} maxLength={4} />
          {errors.cvc && <p className="field-error">{errors.cvc}</p>}
        </div>
      </div>
      <button type="submit" className="btn-primary auth-btn" disabled={paying}>
        {paying ? 'Processing…' : buttonLabel ?? `Pay ${formatUsd(amountCents)}`}
      </button>
    </form>
  );
}

/** Calls one of the demo payment APIs and turns its reply into a CheckoutResult. */
export async function postPayment(url: string, body: unknown): Promise<CheckoutResult> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) return { ok: false, error: 'Too many attempts. Please try again later.' };
  return { ok: false, error: data.error || 'Payment failed', fields: data.fields };
}
