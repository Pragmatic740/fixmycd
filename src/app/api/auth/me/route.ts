import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { serverError } from '@/lib/http';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        bio: user.bio,
        emailNotifications: user.emailNotifications,
      },
    });
  } catch (error: unknown) {
    return serverError(error, 'auth/me');
  }
}
