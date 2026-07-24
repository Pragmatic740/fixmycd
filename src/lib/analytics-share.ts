import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsShareTokens } from '@/db/schema';
import type { AnalyticsFilters } from './analytics-types';
import { sanitizeAnalyticsFilters } from './analytics';

export async function resolveShareToken(token: string): Promise<{
  id: string;
  label: string | null;
  filters: AnalyticsFilters;
} | null> {
  const rows = await db
    .select()
    .from(analyticsShareTokens)
    .where(
      and(
        eq(analyticsShareTokens.token, token),
        isNull(analyticsShareTokens.revokedAt),
        sql`(${analyticsShareTokens.expiresAt} IS NULL OR ${analyticsShareTokens.expiresAt} > NOW())`
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    filters: sanitizeAnalyticsFilters(JSON.parse(row.filtersJson)),
  };
}
