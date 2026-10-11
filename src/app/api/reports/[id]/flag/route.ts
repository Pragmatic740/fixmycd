import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../../../../../db';
import { comments, flags, reports } from '../../../../../db/schema';
import { getSessionUser } from '../../../../../lib/auth';
import { notFound, parseJsonBody, serverError } from '../../../../../lib/http';
import { enforceRateLimit } from '../../../../../lib/rate-limit';
import { flagSchema } from '../../../../../lib/validation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit('flag', sessionUser.id);
    if (limited) return limited;

    const parsed = await parseJsonBody(request, flagSchema);
    if (!parsed.ok) return parsed.response;
    const { reason, targetType } = parsed.data;
    const { id: targetId } = await params;

    const target =
      targetType === 'report'
        ? await db.select({ id: reports.id }).from(reports).where(eq(reports.id, targetId)).limit(1)
        : await db.select({ id: comments.id }).from(comments).where(eq(comments.id, targetId)).limit(1);
    if (target.length === 0) return notFound('Content not found');

    // One open flag per person per item.
    const [existing] = await db
      .select({ id: flags.id })
      .from(flags)
      .where(
        and(
          eq(flags.reporterId, sessionUser.id),
          eq(flags.targetType, targetType),
          eq(flags.targetId, targetId),
          eq(flags.status, 'pending')
        )
      )
      .limit(1);
    if (existing) return NextResponse.json({ success: true, alreadyFlagged: true });

    await db.insert(flags).values({
      id: crypto.randomUUID(),
      targetType,
      targetId,
      reporterId: sessionUser.id,
      reason,
      status: 'pending',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'flag POST');
  }
}
