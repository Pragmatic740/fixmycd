import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { enrichReportLocation } from '@/lib/geo/enrich';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const { id } = await params;
    const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    const report = rows[0];
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const geo = await enrichReportLocation(id, report.latitude, report.longitude);
    return NextResponse.json({ success: true, geography: geo });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Re-enrichment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
