import { NextResponse } from 'next/server';
import { db } from '../../../../../db';
import { reports, users } from '../../../../../db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await db
      .select({
        id: reports.id,
        referenceNo: reports.referenceNo,
        title: reports.title,
        description: reports.description,
        latitude: reports.latitude,
        longitude: reports.longitude,
        severity: reports.severity,
        status: reports.status,
        category: reports.category,
        imageUrl: reports.imageUrl,
        aiSummary: reports.aiSummary,
        createdAt: reports.createdAt,
        userDisplayName: users.displayName,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submitterId, users.id))
      .where(and(eq(reports.id, id), eq(reports.isHidden, false)))
      .limit(1);

    const report = rows[0];
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...report,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
