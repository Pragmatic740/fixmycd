import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reports, reportStatusHistory } from '@/db/schema';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import { containsBlockedContent } from '@/lib/content-filter';
import { fetchReportsWithCounts } from '@/lib/reports';
import { resolveInfrastructure } from '@/lib/categories';
import { enrichReportLocation } from '@/lib/geo/enrich';
import { and, eq } from 'drizzle-orm';
import { badRequest, parseJsonBody, parseQuery, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { reportCreateSchema, reportFeedQuery } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const query = parseQuery(new URL(request.url).searchParams, reportFeedQuery);
    if (!query.ok) return query.response;

    const sessionUser = await getSessionUser();
    const data = await fetchReportsWithCounts(sessionUser?.id ?? null, query.data);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return serverError(error, 'reports GET');
  }
}

/** FMD-YYMMDD-XXXXXX: unique without a lookup (the old 4-digit random number collided). */
function newReferenceNo(now: Date): string {
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `FMD-${ymd}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to report issues.' }, { status: 401 });
    }

    const limited = await enforceRateLimit('report', sessionUser.id);
    if (limited) return limited;

    const parsed = await parseJsonBody(request, reportCreateSchema);
    if (!parsed.ok) return parsed.response;
    const {
      title,
      description,
      latitude,
      longitude,
      severity,
      imageUrl,
      videoUrl,
      audioUrl,
      category,
      subcategory,
      infrastructureClass,
      infrastructureType,
      failureType,
      suspectedCause,
      assetName,
      responsibleAgency,
      isRecurrence,
      postAction,
      postType,
      parentReportId,
      compassDirection,
      evidenceType,
      observationConfidence,
      estimatedCostLow,
      estimatedCostHigh,
      actualCost,
      currency,
      costEstimateSource,
      costConfidence,
      peopleAffected,
      householdsAffected,
      outageDurationHours,
      safetyImpact,
      accessibilityImpact,
      environmentalImpact,
      tags,
      occurredAt,
      addressLine,
      city,
      postalCode,
      county,
      stateProvince,
      countryCode,
    } = parsed.data;

    if (parentReportId) {
      const [parent] = await db
        .select({ id: reports.id })
        .from(reports)
        .where(and(eq(reports.id, parentReportId), eq(reports.isHidden, false)))
        .limit(1);
      if (!parent) return badRequest('Invalid input', { parentReportId: 'Report not found' });
    }

    const blocked = containsBlockedContent(`${title} ${description || ''}`);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }

    const infra = resolveInfrastructure(category, subcategory, infrastructureClass, infrastructureType);
    const reportId = crypto.randomUUID();
    const now = new Date();
    const referenceNo = newReferenceNo(now);

    const newReport = await db.insert(reports).values({
      id: reportId,
      referenceNo,
      submitterId: sessionUser.id,
      title,
      description: description ?? '',
      latitude,
      longitude,
      severity,
      status: 'submitted',
      category: infra.category,
      subcategory: infra.subcategory,
      infrastructureClass: infra.infrastructureClass,
      infrastructureType: infra.infrastructureType,
      failureType: failureType ?? null,
      suspectedCause: suspectedCause ?? null,
      assetName: assetName ?? null,
      responsibleAgency: responsibleAgency ?? null,
      isRecurrence: !!isRecurrence,
      postAction,
      postType,
      parentReportId: parentReportId ?? null,
      imageUrl: imageUrl ?? null,
      videoUrl: videoUrl ?? null,
      audioUrl: audioUrl ?? null,
      compassDirection: compassDirection ?? null,
      evidenceType: evidenceType ?? (imageUrl ? 'photo' : null),
      observationConfidence: observationConfidence ?? null,
      estimatedCostLow: estimatedCostLow ?? null,
      estimatedCostHigh: estimatedCostHigh ?? null,
      actualCost: actualCost ?? null,
      currency,
      costEstimateSource: costEstimateSource ?? null,
      costConfidence: costConfidence ?? null,
      peopleAffected: peopleAffected ?? null,
      householdsAffected: householdsAffected ?? null,
      outageDurationHours: outageDurationHours ?? null,
      safetyImpact: !!safetyImpact,
      accessibilityImpact: !!accessibilityImpact,
      environmentalImpact: !!environmentalImpact,
      tags: tags ?? null,
      occurredAt: occurredAt ? new Date(occurredAt) : now,
      updatedAt: now,
      createdAt: now,
    }).returning();

    await db.insert(reportStatusHistory).values({
      id: crypto.randomUUID(),
      reportId,
      fromStatus: null,
      toStatus: 'submitted',
      changedBy: sessionUser.id,
      note: 'Report created',
      createdAt: now,
    });

    try {
      await enrichReportLocation(reportId, latitude, longitude, {
        addressLine,
        city,
        postalCode,
        county,
        stateProvince,
        countryCode,
      });
    } catch (err) {
      console.error('Geography enrichment failed:', err);
    }

    return NextResponse.json(newReport[0], { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'reports POST');
  }
}