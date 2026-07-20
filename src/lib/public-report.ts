import { db } from '@/db';
import { reports, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getPublicReport(id: string) {
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
      subcategory: reports.subcategory,
      infrastructureClass: reports.infrastructureClass,
      infrastructureType: reports.infrastructureType,
      imageUrl: reports.imageUrl,
      videoUrl: reports.videoUrl,
      audioUrl: reports.audioUrl,
      aiSummary: reports.aiSummary,
      createdAt: reports.createdAt,
      userDisplayName: users.displayName,
    })
    .from(reports)
    .leftJoin(users, eq(reports.submitterId, users.id))
    .where(and(eq(reports.id, id), eq(reports.isHidden, false)))
    .limit(1);

  const report = rows[0];
  if (!report) return null;
  return {
    ...report,
    createdAt: report.createdAt.toISOString(),
  };
}
