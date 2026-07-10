import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { reports, users, flags } from '../../../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getSessionUser, isModerator } from '../../../../lib/auth';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !isModerator(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const queue = await db
      .select({
        id: reports.id,
        referenceNo: reports.referenceNo,
        title: reports.title,
        status: reports.status,
        severity: reports.severity,
        createdAt: reports.createdAt,
        submitterName: users.displayName,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submitterId, users.id))
      .where(and(eq(reports.isHidden, false)))
      .orderBy(desc(reports.createdAt))
      .limit(50);

    const pendingFlags = await db
      .select()
      .from(flags)
      .where(eq(flags.status, 'pending'))
      .orderBy(desc(flags.createdAt))
      .limit(20);

    return NextResponse.json({
      reports: queue.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      flags: pendingFlags.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch review queue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
