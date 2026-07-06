import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { reports, users } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Fetch all reports, ordering by creation time desc
    // Join with users to display submitter's displayName / handle
    const allReports = await db
      .select({
        id: reports.id,
        referenceNo: reports.referenceNo,
        title: reports.title,
        description: reports.description,
        latitude: reports.latitude,
        longitude: reports.longitude,
        severity: reports.severity,
        status: reports.status,
        createdAt: reports.createdAt,
        userDisplayName: users.displayName,
        userEmail: users.email,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submitterId, users.id))
      .orderBy(desc(reports.createdAt));

    return NextResponse.json(allReports);
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('session_user_id');
    const userId = userIdCookie?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to report issues.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, latitude, longitude, severity } = body;

    if (!title || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Title, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const reportId = crypto.randomUUID();
    const referenceNo = `FMD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReport = await db.insert(reports).values({
      id: reportId,
      referenceNo,
      submitterId: userId,
      title,
      description: description || '',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      severity: severity ? parseInt(severity) : 1,
      status: 'submitted',
      createdAt: new Date(),
    }).returning();

    return NextResponse.json(newReport[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
