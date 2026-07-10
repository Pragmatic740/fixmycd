import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { notifications, users, reports } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSessionUser } from '../../../lib/auth';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        read: notifications.read,
        createdAt: notifications.createdAt,
        reportId: notifications.reportId,
        actorDisplayName: users.displayName,
        reportTitle: reports.title,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(reports, eq(notifications.reportId, reports.id))
      .where(eq(notifications.userId, sessionUser.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return NextResponse.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { markAllRead } = await request.json();

    if (markAllRead) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, sessionUser.id));
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update notifications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
