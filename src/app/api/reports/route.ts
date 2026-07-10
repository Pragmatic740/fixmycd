import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { reports, users } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../lib/auth';
import { containsBlockedContent } from '../../../lib/content-filter';
import { fetchReportsWithCounts } from '../../../lib/reports';

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
      postAction,
      postType,
      parentReportId,
      compassDirection,
    } = body;

    if (!title || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Title, latitude, and longitude are required' }, { status: 400 });
    }

    const blocked = containsBlockedContent(`${title} ${description || ''}`);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }

    const reportId = crypto.randomUUID();
    const referenceNo = `FMD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReport = await db.insert(reports).values({
      id: reportId,
      referenceNo,
      submitterId: sessionUser.id,
      title,
      description: description || '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      severity: severity ? parseInt(severity, 10) : 1,
      status: 'submitted',
      category: category || null,
      subcategory: subcategory || null,
      postAction: postAction || 'failure',
      postType: postType || 'new',
      parentReportId: parentReportId || null,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      audioUrl: audioUrl || null,
      compassDirection: compassDirection ? parseFloat(compassDirection) : null,
      createdAt: new Date(),
    }).returning();

    return NextResponse.json(newReport[0], { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
