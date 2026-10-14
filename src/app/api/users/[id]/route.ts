import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { users, reports } from '../../../../db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { getSessionUser, isAdmin } from '../../../../lib/auth';
import { notFound, parseJsonBody, serverError } from '../../../../lib/http';
import { profilePatchSchema } from '../../../../lib/validation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        role: users.role,
        status: users.status,
        disabledAt: users.disabledAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user || user.disabledAt || user.status !== 'approved') return notFound('User not found');

    const userReports = await db
      .select({
        id: reports.id,
        title: reports.title,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(and(eq(reports.submitterId, id), eq(reports.isHidden, false)))
      .orderBy(desc(reports.createdAt))
      .limit(20);

    const sessionUser = await getSessionUser();
    const isSelfOrAdmin = !!sessionUser && (sessionUser.id === id || isAdmin(sessionUser.role));

    return NextResponse.json({
      id: user.id,
      email: isSelfOrAdmin ? user.email : undefined,
      displayName: user.displayName,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      reports: userReports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch (error: unknown) {
    return serverError(error, 'users/[id] GET');
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

    const parsed = await parseJsonBody(request, profilePatchSchema);
    if (!parsed.ok) return parsed.response;

    const [updated] = await db
      .update(users)
      .set(parsed.data)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        role: users.role,
        emailNotifications: users.emailNotifications,
      });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return serverError(error, 'users/[id] PATCH');
  }
}
