import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reports, reportStatusHistory } from '@/db/schema';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import { containsBlockedContent } from '@/lib/content-filter';
import { fetchReportsWithCounts } from '@/lib/reports';
import { resolveInfrastructure } from '@/lib/categories';
import { enrichReportLocation } from '@/lib/geo/enrich';

export async function GET(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    const { searchParams } = new URL(request.url);

    const data = await fetchReportsWithCounts(sessionUser?.id ?? null, {
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      severity: searchParams.get('severity') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      featured: searchParams.get('featured') || undefined,
      userId: searchParams.get('userId') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch reports';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to report issues.' }, { status: 401 });
    }

    const body = await request.json();
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
    } = body;

    if (!title || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Title, latitude, and longitude are required' }, { status: 400 });
    }

    const blocked = containsBlockedContent(`${title} ${description || ''}`);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }

    const sev = severity ? parseInt(severity, 10) : 1;
    if (sev < 1 || sev > 5) {
      return NextResponse.json({ error: 'Severity must be between 1 and 5' }, { status: 400 });
    }

    const infra = resolveInfrastructure(category, subcategory, infrastructureClass, infrastructureType);
    const reportId = crypto.randomUUID();
    const referenceNo = `FMD-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const newReport = await db.insert(reports).values({
      id: reportId,
      referenceNo,
      submitterId: sessionUser.id,
      title,
      description: description || '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      severity: sev,
      status: 'submitted',
      category: infra.category,
      subcategory: infra.subcategory,
      infrastructureClass: infra.infrastructureClass,
      infrastructureType: infra.infrastructureType,
      failureType: failureType || null,
      suspectedCause: suspectedCause || null,
      assetName: assetName || null,
      responsibleAgency: responsibleAgency || null,
      isRecurrence: !!isRecurrence,
      postAction: postAction || 'failure',
      postType: postType || 'new',
      parentReportId: parentReportId || null,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      audioUrl: audioUrl || null,
      compassDirection: compassDirection ? parseFloat(compassDirection) : null,
      evidenceType: evidenceType || (imageUrl ? 'photo' : null),
      observationConfidence: observationConfidence ? parseInt(observationConfidence, 10) : null,
      estimatedCostLow: estimatedCostLow != null ? parseFloat(estimatedCostLow) : null,
      estimatedCostHigh: estimatedCostHigh != null ? parseFloat(estimatedCostHigh) : null,
      actualCost: actualCost != null ? parseFloat(actualCost) : null,
      currency: currency || 'USD',
      costEstimateSource: costEstimateSource || null,
      costConfidence: costConfidence ? parseInt(costConfidence, 10) : null,
      peopleAffected: peopleAffected != null ? parseInt(peopleAffected, 10) : null,
      householdsAffected: householdsAffected != null ? parseInt(householdsAffected, 10) : null,
      outageDurationHours: outageDurationHours != null ? parseFloat(outageDurationHours) : null,
      safetyImpact: !!safetyImpact,
      accessibilityImpact: !!accessibilityImpact,
      environmentalImpact: !!environmentalImpact,
      tags: Array.isArray(tags) ? tags.join(',') : tags || null,
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

    // Enrich geography asynchronously-safe (await but non-fatal)
    try {
      await enrichReportLocation(reportId, parseFloat(latitude), parseFloat(longitude), {
        addressLine,
        city,
        postalCode,
        county,
        stateProvince,
        countryCode: countryCode || undefined,
      });
    } catch (err) {
      console.error('Geography enrichment failed:', err);
    }

    return NextResponse.json(newReport[0], { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
