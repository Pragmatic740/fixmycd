import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { reports, reportLocations } from '@/db/schema';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { CSV_TEMPLATE, mapCsvRow, parseCsv } from '@/lib/csv-import';

const BATCH = 40;

export async function GET() {
  return new NextResponse(CSV_TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fixmydistrict-import-template.csv"',
    },
  });
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const contentType = request.headers.get('content-type') || '';
    let text = '';
    let datasetKey = `csv-import-${Date.now()}`;
    let useStockPhotos = true;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file required' }, { status: 400 });
      }
      text = await file.text();
      datasetKey = String(form.get('datasetKey') || datasetKey).trim() || datasetKey;
      useStockPhotos = String(form.get('useStockPhotos') || 'true') !== 'false';
    } else {
      const body = await request.json();
      text = String(body.csv || '');
      datasetKey = String(body.datasetKey || datasetKey).trim() || datasetKey;
      useStockPhotos = body.useStockPhotos !== false;
    }

    const { rows } = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
    }

    const submitterId = admin.id;

    const mapped = [];
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const m = mapCsvRow(rows[i], i, { datasetKey, useStockPhotos });
      if ('error' in m && m.error) {
        errors.push(m.error);
        continue;
      }
      mapped.push(m as Exclude<typeof m, { error: string }>);
    }

    const ids = mapped.map((m) => m.reportId);
    const existing = ids.length
      ? await db.select({ id: reports.id }).from(reports).where(inArray(reports.id, ids))
      : [];
    const have = new Set(existing.map((e) => e.id));
    const toInsert = mapped.filter((m) => !have.has(m.reportId));

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH);
      await db.insert(reports).values(
        chunk.map((m) => ({
          id: m.reportId,
          referenceNo: `CSV-${m.reportId.slice(-8).toUpperCase()}`,
          submitterId,
          title: m.title,
          description: m.description,
          latitude: m.latitude,
          longitude: m.longitude,
          severity: m.severity,
          status: m.status,
          category: m.infrastructureClass,
          subcategory: m.infrastructureType,
          infrastructureClass: m.infrastructureClass,
          infrastructureType: m.infrastructureType,
          failureType: m.failureType,
          assetName: m.assetName,
          responsibleAgency: 'DOT',
          postAction: 'failure',
          evidenceType: m.imageUrl ? 'photo' : 'data_import',
          estimatedCostLow: m.estimatedCostLow,
          estimatedCostHigh: m.estimatedCostHigh,
          currency: 'USD',
          imageUrl: m.imageUrl,
          isHidden: false,
          isSynthetic: true,
          datasetKey: m.datasetKey,
          occurredAt: m.occurredAt,
          createdAt: m.occurredAt,
          updatedAt: m.occurredAt,
        }))
      );
      await db.insert(reportLocations).values(
        chunk.map((m) => ({
          id: m.locId,
          reportId: m.reportId,
          addressLine: m.addressLine,
          city: m.city,
          postalCode: m.postalCode,
          county: m.county,
          stateProvince: m.state,
          countryCode: 'US',
          latitude: m.latitude,
          longitude: m.longitude,
          geocodeStatus: 'matched',
          geocodeSource: 'csv-import',
          geocodeConfidence: 0.8,
          congressionalDistrict: m.congressionalDistrict,
          createdAt: m.occurredAt,
          updatedAt: m.occurredAt,
        }))
      );
    }

    return NextResponse.json({
      datasetKey,
      inserted: toInsert.length,
      skipped: have.size,
      errors,
      preview: mapped.slice(0, 5).map((m) => ({
        title: m.title,
        latitude: m.latitude,
        longitude: m.longitude,
        severity: m.severity,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'CSV import failed';
    console.error('CSV import error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
