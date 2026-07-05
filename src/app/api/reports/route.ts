import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reports } from '@/db/schema';

export async function GET(request: Request) {
  try {
    // For the MVP prototype with SQLite, we'll just return all reports.
    // In production with PostGIS, we'd do a radius query based on request URL params.
    const allReports = await db.select().from(reports);
    return NextResponse.json({ data: allReports });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.title || !body.latitude || !body.longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newReport = await db.insert(reports).values({
      id: crypto.randomUUID(),
      referenceNo: `FMD-${Math.floor(Math.random() * 10000)}`,
      submitterId: 'mock-user-1', // Mocked user for MVP
      title: body.title,
      description: body.description || '',
      latitude: body.latitude,
      longitude: body.longitude,
      severity: body.severity || 1,
      createdAt: new Date(),
    }).returning();

    return NextResponse.json({ data: newReport[0] }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
