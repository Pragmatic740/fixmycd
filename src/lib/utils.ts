/**
 * "5m ago" style timestamps. `compact` drops "ago" for dense lists ("5m").
 * Invalid input gives '' and small clock-skew into the future reads "just now".
 */
export function formatRelativeTime(
  date: Date | string,
  { compact = false, now = new Date() }: { compact?: boolean; now?: Date } = {}
): string {
  const past = new Date(date);
  if (Number.isNaN(past.getTime())) return '';
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  const ago = compact ? '' : ' ago';

  if (diffInSeconds < 60) {
    // Up to a minute in the future is clock skew; further is a real future date.
    if (diffInSeconds > -60) return compact ? 'now' : 'just now';
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m${ago}`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h${ago}`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d${ago}`;

  const sameYear = past.getFullYear() === now.getFullYear();
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Public @handle derived from a display name (emails are never shown to other users). */
export function handleFor(displayName: string | null | undefined): string {
  const slug = (displayName ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '');
  return slug.slice(0, 24) || 'citizen';
}
