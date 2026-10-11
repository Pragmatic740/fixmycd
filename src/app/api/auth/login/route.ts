import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_OPTIONS } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const userList = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userList[0];

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.disabledAt) {
      return NextResponse.json(
        { error: 'Account has been disabled' },
        { status: 403 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Your account is pending approval. Please wait for admin approval.' },
        { status: 403 }
      );
    }

    if (user.status === 'rejected') {
      return NextResponse.json(
        { error: 'Your account was not approved. Please contact support.' },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set('session_user_id', user.id, SESSION_COOKIE_OPTIONS);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    });
  } catch (error: unknown) {
    // Drizzle wraps driver errors ("Failed query: ..."); the real reason
    // (e.g. a missing column) is on `cause`. Log it, but never send SQL to the client.
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    console.error('Login error:', error, cause ? `\nCause: ${cause}` : '');
    return NextResponse.json(
      { error: 'Login is temporarily unavailable. Please try again later.' },
      { status: 500 }
    );
  }
}