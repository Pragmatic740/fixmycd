import { NextResponse } from 'next/server';
import { db } from '../../../../../db';
import { flags } from '../../../../../db/schema';
import crypto from 'crypto';
import { getSessionUser } from '../../../../../lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: targetId } = await params;
    const { reason, targetType = 'report' } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    await db.insert(flags).values({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      reporterId: sessionUser.id,
      reason: reason.trim(),
      status: 'pending',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to flag content';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
