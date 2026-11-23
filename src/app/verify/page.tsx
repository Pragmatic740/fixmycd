'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DemoCheckout, postPayment } from '@/components/DemoCheckout';
import { WhyOneDollar } from '@/components/WhyOneDollar';

/** For accounts still waiting for approval: activate now with the $1 check (demo). */
function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');

  return (
    <>
      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <DemoCheckout
        amountCents={100}
        buttonLabel="Pay $1 and activate my account"
        onPay={async (card) => {
          const result = await postPayment('/api/verify', { email, password, card });
          if (result.ok) router.push('/dashboard');
          return result;
        }}
      />
    </>
  );
}

export default function VerifyPage() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <img src="/logo.svg" alt="FixMyDistrict" />
          <span>FixMyDistrict</span>
        </Link>
        <h2>Activate your account</h2>
        <WhyOneDollar />
        <Suspense fallback={null}>
          <VerifyForm />
        </Suspense>
        <p className="auth-footer">
          Already active? <Link href="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}
