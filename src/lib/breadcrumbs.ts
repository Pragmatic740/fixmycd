/**
 * "Where am I" trail for the dashboard (Home › Account › Profile). Kept free of
 * React so the route → label rules can be unit tested.
 */
export type Crumb = { label: string; href: string };

const HOME: Crumb = { label: 'Home', href: '/dashboard' };
const ACCOUNT: Crumb = { label: 'Account', href: '/dashboard/account' };

/** Pages and the trail above them (Home is always first). */
const ROUTES: Record<string, { label: string; parents: Crumb[] }> = {
  '/dashboard/explore': { label: 'Explore', parents: [] },
  '/dashboard/analytics': { label: 'Analytics', parents: [] },
  '/dashboard/notifications': { label: 'Notifications', parents: [] },
  '/dashboard/account': { label: 'Account', parents: [] },
  '/dashboard/account/profile': { label: 'Profile', parents: [ACCOUNT] },
  '/dashboard/account/users': { label: 'Users & approvals', parents: [ACCOUNT] },
  '/dashboard/account/ethics': { label: 'Code of Ethics', parents: [ACCOUNT] },
  '/dashboard/account/donate': { label: 'Donate', parents: [ACCOUNT] },
  '/dashboard/review': { label: 'Review queue', parents: [ACCOUNT] },
};

/** Pages with an id in the URL: label for the last crumb. */
const DYNAMIC: Array<{ prefix: string; label: string }> = [
  { prefix: '/dashboard/reports/', label: 'Post' },
  { prefix: '/dashboard/u/', label: 'Member' },
];

export function breadcrumbsFor(pathname: string): Crumb[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/dashboard') return [HOME];

  const route = ROUTES[path];
  if (route) return [HOME, ...route.parents, { label: route.label, href: path }];

  const dynamic = DYNAMIC.find((d) => path.startsWith(d.prefix) && path.length > d.prefix.length);
  if (dynamic) return [HOME, { label: dynamic.label, href: path }];

  return [HOME];
}

/** True when `pathname` is inside the Account section (used to keep its menu open). */
export function isInAccountSection(pathname: string): boolean {
  return breadcrumbsFor(pathname).some((c) => c.href === ACCOUNT.href);
}
