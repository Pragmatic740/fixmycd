import { NextResponse } from 'next/server';
import { db } from '../../../db';
import { reports, users } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

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
    const body = await request.json();
    const { title, description, latitude, longitude, severity } = body;

    if (!title || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Title, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    // Get first user or create a default one for submitterId
    let userList = await db.select().from(users).limit(1);
    let userId = userList[0]?.id;

    if (!userId) {
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email: 'anonymous@fixmydistrict.app',
        displayName: 'Anonymous Citizen',
        role: 'viewer',
        createdAt: new Date(),
      });
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
