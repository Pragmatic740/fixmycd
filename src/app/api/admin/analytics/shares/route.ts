import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq, desc, and, isNull, sql, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsSavedViews, analyticsShareTokens, shareViewEvents, users } from '@/db/schema';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { filtersForPersist } from '@/lib/analytics';
import { badRequest, notFound, parseJsonBody, serverError } from '@/lib/http';
import { shareCreateSchema } from '@/lib/validation';

const toIso = (v: Date | string | null) => (v == null ? null : new Date(v).toISOString());

/** Share links are team-wide: any admin can see and revoke any active link. */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const rows = await db
      .select({
        id: analyticsShareTokens.id,
        token: analyticsShareTokens.token,
        label: analyticsShareTokens.label,
        createdAt: analyticsShareTokens.createdAt,
        expiresAt: analyticsShareTokens.expiresAt,
        createdBy: analyticsShareTokens.createdBy,
        createdByName: users.displayName,
      })
      .from(analyticsShareTokens)
      .leftJoin(users, eq(users.id, analyticsShareTokens.createdBy))
      .where(isNull(analyticsShareTokens.revokedAt))
      .orderBy(desc(analyticsShareTokens.createdAt));

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    const tokenIds = rows.map((r) => r.id);
    const since = new Date(Date.now() - 14 * 86400000);
    const viewCounts = await db
      .select({
        tokenId: shareViewEvents.tokenId,
        count: sql<number>`cast(count(*) as int)`,
        lastViewed: sql<Date | string | null>`max(${shareViewEvents.viewedAt})`,
        recent: sql<number>`cast(count(*) filter (where ${shareViewEvents.viewedAt} >= ${since.toISOString()}::timestamptz) as int)`,
      })
      .from(shareViewEvents)
      .where(inArray(shareViewEvents.tokenId, tokenIds))
      .groupBy(shareViewEvents.tokenId);

    const viewsByToken = new Map(viewCounts.map((v) => [v.tokenId, v]));
    const now = Date.now();

    return NextResponse.json(
      rows.map((r) => {
        const views = viewsByToken.get(r.id);
        return {
          id: r.id,
          token: r.token,
          label: r.label,
          urlPath: `/v/${r.token}`,
          createdAt: r.createdAt.toISOString(),
          expiresAt: toIso(r.expiresAt),
          expired: r.expiresAt != null && r.expiresAt.getTime() <= now,
          createdByName: r.createdByName,
          mine: r.createdBy === admin.id,
          viewCount: views?.count ?? 0,
          viewsLast14Days: views?.recent ?? 0,
          lastViewedAt: toIso(views?.lastViewed ?? null),
        };
      })
    );
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/shares GET');
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const parsed = await parseJsonBody(request, shareCreateSchema);
    if (!parsed.ok) return parsed.response;
    const { label, savedViewId, expiresAt } = parsed.data;
    const filters = filtersForPersist(parsed.data.filters);

    if (savedViewId) {
      const [view] = await db
        .select({ id: analyticsSavedViews.id })
        .from(analyticsSavedViews)
        .where(eq(analyticsSavedViews.id, savedViewId))
        .limit(1);
      if (!view) return badRequest('Invalid input', { savedViewId: 'Saved view not found' });
    }

    const id = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString('base64url');
    const now = new Date();
    const expires = expiresAt ? new Date(expiresAt) : null;

    await db.insert(analyticsShareTokens).values({
      id,
      token,
      createdBy: admin.id,
      savedViewId: savedViewId ?? null,
      filtersJson: JSON.stringify(filters),
      label: label ?? null,
      expiresAt: expires,
      createdAt: now,
    });

    return NextResponse.json(
      {
        id,
        token,
        label: label ?? null,
        urlPath: `/v/${token}`,
        createdAt: now.toISOString(),
        expiresAt: expires?.toISOString() ?? null,
        expired: false,
        mine: true,
        viewCount: 0,
        viewsLast14Days: 0,
        lastViewedAt: null,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/shares POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const id = new URL(request.url).searchParams.get('id');
    if (!id || id.length > 100) return badRequest('id required');

    const updated = await db
      .update(analyticsShareTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(analyticsShareTokens.id, id), isNull(analyticsShareTokens.revokedAt)))
      .returning({ id: analyticsShareTokens.id });

    if (!updated[0]) return notFound('Share not found');
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'admin/analytics/shares DELETE');
  }
}
