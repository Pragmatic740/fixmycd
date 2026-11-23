'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { breadcrumbsFor } from '@/lib/breadcrumbs';

/** Home › Account › Profile — shown above each page's own header (not on Home). */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = breadcrumbsFor(pathname);
  if (crumbs.length < 2) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.href}>
              {last ? (
                <span aria-current="page">{crumb.label}</span>
              ) : (
                <Link href={crumb.href}>{crumb.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
