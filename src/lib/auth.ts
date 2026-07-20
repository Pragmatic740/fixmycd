import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export type SessionUser = typeof users.$inferSelect;

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('session_user_id')?.value ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userList[0];
  if (!user || user.disabledAt) return null;
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

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};
