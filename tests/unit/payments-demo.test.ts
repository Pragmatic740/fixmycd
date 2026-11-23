import { describe, expect, it } from 'vitest';
import { checkDemoCard, formatUsd, parseExpiry, passesLuhn } from '@/lib/payments-demo';

const NOW = new Date('2026-11-23T12:00:00Z');
const good = { number: '4242 4242 4242 4242', expiry: '12/28', cvc: '123', name: 'Ada Lovelace' };

describe('demo card checks', () => {
  it('runs the Luhn checksum', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4242424242424241')).toBe(false);
    expect(passesLuhn('5555555555554444')).toBe(true);
    expect(passesLuhn('abc')).toBe(false);
  });

  it('accepts only the test card and keeps just the last 4 digits', () => {
    expect(checkDemoCard(good, NOW)).toEqual({ ok: true, last4: '4242' });
    const real = checkDemoCard({ ...good, number: '5555 5555 5555 4444' }, NOW);
    expect(real.ok).toBe(false);
    if (!real.ok) expect(real.errors.number).toMatch(/test card/);
    const typo = checkDemoCard({ ...good, number: '4242 4242 4242 4241' }, NOW);
    if (!typo.ok) expect(typo.errors.number).toMatch(/valid card number/);
  });

  it('checks expiry, CVC and name', () => {
    expect(parseExpiry('11/26', NOW).ok).toBe(true); // valid through the end of the month
    expect(parseExpiry('10/26', NOW)).toEqual({ ok: false, error: 'This card has expired' });
    expect(parseExpiry('13/27', NOW).ok).toBe(false);
    expect(parseExpiry('1227', NOW).ok).toBe(false);
    expect(parseExpiry('03/2029', NOW).ok).toBe(true);
    const bad = checkDemoCard({ number: '4242424242424242', expiry: '01/20', cvc: '12', name: '' }, NOW);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['cvc', 'expiry', 'name']);
  });

  it('formats dollar amounts', () => {
    expect(formatUsd(100)).toBe('$1');
    expect(formatUsd(2550)).toBe('$25.50');
  });
});
