import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { notifications, users, reports } from '../../../db/schema';
import { and, eq, desc, inArray, lt, sql } from 'drizzle-orm';
import { getSessionUser } from '../../../lib/auth';
import { parseJsonBody, parseQuery, serverError } from '../../../lib/http';
import { notificationsPatchSchema, notificationsQuery } from '../../../lib/validation';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const query = parseQuery(new URL(request.url).searchParams, notificationsQuery);
    if (!query.ok) return query.response;
    const { limit, before, unread } = query.data;

    const conditions = [eq(notifications.userId, sessionUser.id)];
    if (before) conditions.push(lt(notifications.createdAt, new Date(before)));
    if (unread === 'true') conditions.push(eq(notifications.read, false));

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        read: notifications.read,
        createdAt: notifications.createdAt,
        reportId: notifications.reportId,
        metadataJson: notifications.metadataJson,
        actorDisplayName: users.displayName,
        reportTitle: reports.title,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(reports, eq(notifications.reportId, reports.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);

    const [{ unreadCount }] = await db
      .select({ unreadCount: sql<number>`cast(count(*) as int)` })
      .from(notifications)
      .where(and(eq(notifications.userId, sessionUser.id), eq(notifications.read, false)));

    const page = rows.slice(0, limit);
    return NextResponse.json({
      items: page.map(({ metadataJson, ...r }) => ({
        ...r,
        metadata: parseMetadata(metadataJson),
        createdAt: r.createdAt.toISOString(),
      })),
      unreadCount,
      nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
    });
  } catch (error: unknown) {
    return serverError(error, 'notifications GET');
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return unauthorized();

    const parsed = await parseJsonBody(request, notificationsPatchSchema);
    if (!parsed.ok) return parsed.response;

    const mine = eq(notifications.userId, sessionUser.id);
    await db
      .update(notifications)
      .set({ read: true })
      .where('ids' in parsed.data ? and(mine, inArray(notifications.id, parsed.data.ids)) : mine);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'notifications PATCH');
  }
}
