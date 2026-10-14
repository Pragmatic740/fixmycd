import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { adminAuditLog, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { isAdmin, isAuthError, isSuperAdmin, requireAdmin, revokeUserSessions } from '@/lib/auth';
import { notFound, parseJsonBody, parseQuery, serverError } from '@/lib/http';
import { adminUserListQuery, adminUserPatchSchema } from '@/lib/validation';
import { sendAccountDecisionEmail } from '@/lib/email';
import { runAfterResponse } from '@/lib/notify';

const ASSIGNABLE_BY_ADMIN = ['submitter', 'viewer', 'referee', 'admin'];

const userListColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  disabledAt: users.disabledAt,
  isSynthetic: users.isSynthetic,
  createdAt: users.createdAt,
};

type UserListRow = { createdAt: Date; disabledAt: Date | null } & Record<string, unknown>;
const serialize = (u: UserListRow) => ({
  ...u,
  createdAt: u.createdAt.toISOString(),
  disabledAt: u.disabledAt?.toISOString() ?? null,
});

const forbidden = (error: string) => NextResponse.json({ error }, { status: 403 });

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const query = parseQuery(new URL(request.url).searchParams, adminUserListQuery);
    if (!query.ok) return query.response;

    const base = db.select(userListColumns).from(users);
    const rows = await (query.data.status ? base.where(eq(users.status, query.data.status)) : base).orderBy(
      desc(users.createdAt)
    );

    return NextResponse.json(rows.map(serialize));
  } catch (error: unknown) {
    return serverError(error, 'admin/users GET');
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const parsed = await parseJsonBody(request, adminUserPatchSchema);
    if (!parsed.ok) return parsed.response;
    const { userId, disabled, role, status } = parsed.data;

    if (userId === admin.id) {
      return forbidden('You cannot change your own account here');
    }

    const [target] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        disabledAt: users.disabledAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) return notFound('User not found');

    // Admins manage regular accounts; only a super_admin manages other admins.
    if (isAdmin(target.role) && !isSuperAdmin(admin.role)) {
      return forbidden('Only a super_admin can change admin accounts');
    }

    const patch: { disabledAt?: Date | null; role?: string; status?: string } = {};
    if (disabled !== undefined) {
      patch.disabledAt = disabled ? (target.disabledAt ?? new Date()) : null;
    }
    if (role !== undefined) {
      if (!isSuperAdmin(admin.role) && !ASSIGNABLE_BY_ADMIN.includes(role)) {
        return forbidden('Only a super_admin can grant that role');
      }
      patch.role = role;
    }
    if (status !== undefined) patch.status = status;

    const [updated] = await db.update(users).set(patch).where(eq(users.id, userId)).returning(userListColumns);

    const roleChanged = role !== undefined && role !== target.role;
    const lostAccess = disabled === true || (status !== undefined && status !== 'approved');
    if (roleChanged || lostAccess) {
      await revokeUserSessions(userId);
    }

    // Let the person know when their signup request is decided.
    if (status !== undefined && status !== target.status && status !== 'pending') {
      runAfterResponse('account-decision-email', () =>
        sendAccountDecisionEmail({ to: target.email, displayName: target.displayName, approved: status === 'approved' })
      );
    }

    await db.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      actorId: admin.id,
      action: 'user.update',
      targetType: 'user',
      targetId: userId,
      detailsJson: JSON.stringify({
        before: { role: target.role, status: target.status, disabled: target.disabledAt !== null },
        changes: { disabled, role, status },
      }),
      createdAt: new Date(),
    });

    return NextResponse.json(serialize(updated));
  } catch (error: unknown) {
    return serverError(error, 'admin/users PATCH');
  }
}
