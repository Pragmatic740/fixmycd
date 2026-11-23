import { describe, expect, it } from 'vitest';
import { breadcrumbsFor, isInAccountSection } from '@/lib/breadcrumbs';

const labels = (path: string) => breadcrumbsFor(path).map((c) => c.label);

describe('breadcrumbs', () => {
  it('shows only Home on the home feed and unknown pages', () => {
    expect(labels('/dashboard')).toEqual(['Home']);
    expect(labels('/dashboard/does-not-exist')).toEqual(['Home']);
  });

  it('nests account pages under Account', () => {
    expect(labels('/dashboard/account')).toEqual(['Home', 'Account']);
    expect(labels('/dashboard/account/profile')).toEqual(['Home', 'Account', 'Profile']);
    expect(labels('/dashboard/account/users')).toEqual(['Home', 'Account', 'Users & approvals']);
    expect(labels('/dashboard/review')).toEqual(['Home', 'Account', 'Review queue']);
  });

  it('links each crumb to its page, the last one to the current page', () => {
    expect(breadcrumbsFor('/dashboard/account/profile/')).toEqual([
      { label: 'Home', href: '/dashboard' },
      { label: 'Account', href: '/dashboard/account' },
      { label: 'Profile', href: '/dashboard/account/profile' },
    ]);
  });

  it('handles top-level and id pages', () => {
    expect(labels('/dashboard/analytics')).toEqual(['Home', 'Analytics']);
    expect(labels('/dashboard/explore')).toEqual(['Home', 'Explore']);
    expect(labels('/dashboard/reports/rpt_123')).toEqual(['Home', 'Post']);
    expect(labels('/dashboard/reports/')).toEqual(['Home']);
  });

  it('knows which pages belong to the Account section', () => {
    expect(isInAccountSection('/dashboard/account')).toBe(true);
    expect(isInAccountSection('/dashboard/account/users')).toBe(true);
    expect(isInAccountSection('/dashboard/review')).toBe(true);
    expect(isInAccountSection('/dashboard/analytics')).toBe(false);
    expect(isInAccountSection('/dashboard')).toBe(false);
  });
});
