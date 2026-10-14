import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users } from '../db/schema';

/** Cookie holding the opaque session token. */
export const SESSION_COOKIE = 'fmd_session';
/** Pre-October cookie that stored the raw user id. Never trusted; cleared on login/logout. */
export const LEGACY_SESSION_COOKIE = 'session_user_id';

/** bcrypt cost for newly created password hashes (existing hashes keep verifying). */
export const PASSWORD_HASH_COST = 12;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_SEEN_RESOLUTION_MS = 15 * 60 * 1000;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
};

/** Columns a request may know about the signed-in user (never the password hash). */
const sessionUserColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  bio: users.bio,
  emailNotifications: users.emailNotifications,
  isSynthetic: users.isSynthetic,
  createdAt: users.createdAt,
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  bio: string | null;
  emailNotifications: boolean;
  isSynthetic: boolean;
  createdAt: Date;
};

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Start a session for a user and set the session cookie. Route handlers only. */
export async function createSession(userId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await db.insert(sessions).values({
    id: hashSessionToken(token),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  // Opportunistic cleanup of this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, now)));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  cookieStore.delete(LEGACY_SESSION_COOKIE);
}

/** End the current session (if any) and clear cookies. Route handlers only. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(LEGACY_SESSION_COOKIE);
}

/** Sign a user out everywhere (used when an account is disabled, rejected or its role changes). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * The signed-in user, or null. Only active sessions of approved, enabled
 * accounts count. Safe to call from Server Components (never writes cookies).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;

  const now = new Date();
  const rows = await db
    .select({ ...sessionUserColumns, sessionId: sessions.id, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, hashSessionToken(token)),
        gt(sessions.expiresAt, now),
        isNull(users.disabledAt),
        eq(users.status, 'approved')
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.sessionId));
  }

  const { sessionId: _sessionId, lastSeenAt: _lastSeenAt, ...user } = row;
  return user;
}

export function isModerator(role: string) {
  return role === 'referee' || role === 'admin' || role === 'super_admin';
}

export function isAdmin(role: string) {
  return role === 'admin' || role === 'super_admin';
}

export function isSuperAdmin(role: string) {
  return role === 'super_admin';
}

export function isExpert(role: string) {
  return role === 'referee' || role === 'admin' || role === 'super_admin';
}

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

export async function requireExpert(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isExpert(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden — expert access required' },
      { status: 403 }
    );
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdmin(user.role)) {
    return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
  }
  return user;
}

export async function requireModerator(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isModerator(user.role)) {
    return NextResponse.json({ error: 'Forbidden — moderator access required' }, { status: 403 });
  }
  return user;
}

export function isAuthError(value: SessionUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
