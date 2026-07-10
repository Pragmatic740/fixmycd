import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { users, reports } from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSessionUser } from '../../../../lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = userRows[0];
    if (!user || user.disabledAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userReports = await db
      .select({
        id: reports.id,
        title: reports.title,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(eq(reports.submitterId, id))
      .orderBy(desc(reports.createdAt))
      .limit(20);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      reports: userReports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (sessionUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { displayName, bio } = await request.json();

    const updated = await db
      .update(users)
      .set({
        displayName: displayName ?? sessionUser.displayName,
        bio: bio ?? sessionUser.bio,
      })
      .where(eq(users.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
