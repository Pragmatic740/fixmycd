import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { serverError } from '@/lib/http';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'auth/logout');
  }
}
