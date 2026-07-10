import { NextResponse } from 'next/server';
import { fetchTrendingReports } from '../../../lib/reports';

export async function GET() {
  try {
    const trending = await fetchTrendingReports(5);
    return NextResponse.json(trending);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch trending';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
