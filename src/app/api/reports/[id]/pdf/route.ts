import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  reports,
  reportLocations,
  users,
  endorsements,
  comments,
  reportStatusHistory,
  upvotes,
} from '@/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import { clientIp, notFound, serverError } from '@/lib/http';
import { fetchImageForEmbedding } from '@/lib/media-fetch';
import { formatPdfDate, toWinAnsi, wrapText } from '@/lib/pdf-text';
import { enforceRateLimit } from '@/lib/rate-limit';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const PAGE: [number, number] = [612, 792];
const MARGIN = 50;
const BOTTOM = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await enforceRateLimit('pdf', clientIp(request));
    if (limited) return limited;

    const { id } = await params;

    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.isHidden, false)))
      .limit(1);
    if (!report) return notFound('Report not found');

    const [locationRows, submitterRows, endorsementRows, commentRows, historyRows, upvoteRows] =
      await Promise.all([
        db.select().from(reportLocations).where(eq(reportLocations.reportId, id)).limit(1),
        db.select({ displayName: users.displayName }).from(users).where(eq(users.id, report.submitterId)).limit(1),
        db
          .select({
            severityLevel: endorsements.severityLevel,
            note: endorsements.note,
            createdAt: endorsements.createdAt,
            expertName: users.displayName,
          })
          .from(endorsements)
          .innerJoin(users, eq(endorsements.expertUserId, users.id))
          .where(and(eq(endorsements.reportId, id), isNull(users.disabledAt)))
          .orderBy(desc(endorsements.createdAt)),
        db
          .select({
            body: comments.body,
            createdAt: comments.createdAt,
            userName: users.displayName,
          })
          .from(comments)
          .innerJoin(users, eq(comments.userId, users.id))
          .where(and(eq(comments.reportId, id), eq(comments.isHidden, false), isNull(users.disabledAt)))
          .orderBy(desc(comments.createdAt))
          .limit(10),
        db
          .select()
          .from(reportStatusHistory)
          .where(eq(reportStatusHistory.reportId, id))
          .orderBy(desc(reportStatusHistory.createdAt))
          .limit(20),
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(upvotes).where(eq(upvotes.reportId, id)),
      ]);

    const location = locationRows[0];
    const submitter = submitterRows[0];

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(toWinAnsi(`Incident ${report.referenceNo}: ${report.title}`));
    pdfDoc.setProducer('FixMyDistrict');
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage(PAGE);
    const { width, height } = page.getSize();
    const textWidth = width - MARGIN * 2;
    let y = height - MARGIN;

    const ensureSpace = (needed: number) => {
      if (y - needed < BOTTOM) {
        page = pdfDoc.addPage(PAGE);
        y = height - MARGIN;
      }
    };

    type LineOptions = { bold?: boolean; size?: number; color?: [number, number, number]; indent?: number };

    /** Draw text, wrapping by measured width onto as many lines/pages as needed. */
    const write = (text: string, options: LineOptions = {}) => {
      const size = options.size ?? 11;
      const f: PDFFont = options.bold ? boldFont : font;
      const [r, g, b] = options.color ?? [0, 0, 0];
      const indent = options.indent ?? 0;
      for (const line of wrapText(text, f, size, textWidth - indent)) {
        ensureSpace(size + 6);
        if (line) page.drawText(line, { x: MARGIN + indent, y, size, font: f, color: rgb(r, g, b) });
        y -= size + 6;
      }
    };

    const section = (title: string) => {
      y -= 4;
      ensureSpace(40);
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: width - MARGIN, y },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      y -= 16;
      write(title, { bold: true, size: 12 });
    };

    const reportUrl = `${BASE_URL}/r/${encodeURIComponent(report.id)}`;

    write('FixMyDistrict - Incident Report', { bold: true, size: 18 });
    write(`Reference: ${report.referenceNo}`, { size: 12, color: [0.3, 0.3, 0.3] });
    write(`Online: ${reportUrl}`, { size: 9, color: [0.2, 0.3, 0.8] });
    y -= 6;

    section(report.title);
    write(`Status: ${report.status.replace(/_/g, ' ')}`);
    write(`Severity: ${report.severity ?? 'N/A'}`);
    write(`Category: ${report.category || 'N/A'}${report.subcategory ? ` / ${report.subcategory}` : ''}`);
    write(`Failure Type: ${report.failureType || 'N/A'}`);
    write(`Reported by: ${submitter?.displayName || 'Anonymous'}`);
    write(`Reported on: ${formatPdfDate(report.createdAt, true)}`);
    if (report.occurredAt) write(`Observed on: ${formatPdfDate(report.occurredAt, true)}`);
    write(`Community upvotes: ${upvoteRows[0]?.count ?? 0}`);

    if (report.imageUrl) {
      const img = await fetchImageForEmbedding(report.imageUrl);
      section('Photo Evidence');
      if (img) {
        try {
          const embedded = img.type === 'png' ? await pdfDoc.embedPng(img.bytes) : await pdfDoc.embedJpg(img.bytes);
          const scale = Math.min(textWidth / embedded.width, 300 / embedded.height, 1);
          const w = embedded.width * scale;
          const h = embedded.height * scale;
          ensureSpace(h + 12);
          page.drawImage(embedded, { x: MARGIN, y: y - h, width: w, height: h });
          y -= h + 12;
        } catch (err) {
          console.error('Failed to embed photo:', err);
          write('Photo could not be embedded; view it online.', { size: 10, color: [0.4, 0.4, 0.4] });
        }
      } else {
        write('Photo available online (format cannot be embedded).', { size: 10, color: [0.4, 0.4, 0.4] });
      }
    }

    if (report.videoUrl || report.audioUrl) {
      section('Additional Media');
      if (report.videoUrl) write(report.videoUrl.startsWith('data:') ? 'Video: attached (view online)' : `Video: ${report.videoUrl}`, { size: 9, color: [0.3, 0.3, 0.8] });
      if (report.audioUrl) write(report.audioUrl.startsWith('data:') ? 'Audio: attached (view online)' : `Audio: ${report.audioUrl}`, { size: 9, color: [0.3, 0.3, 0.8] });
    }

    section('Location');
    write(`Coordinates: ${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`);
    if (location) {
      if (location.addressLine) write(`Address: ${location.addressLine}`);
      if (location.city) write(`City: ${location.city}`);
      if (location.stateProvince) write(`State: ${location.stateProvince}`);
      if (location.postalCode) write(`ZIP: ${location.postalCode}`);
      if (location.county) write(`County: ${location.county}`);
      if (location.congressionalDistrict) write(`Congressional District: ${location.congressionalDistrict}`);
    }

    section('Description');
    write(report.description || 'No description');

    if (report.aiSummary) {
      section('AI Summary');
      write(report.aiSummary, { color: [0.4, 0.4, 0.4] });
    }

    if (endorsementRows.length > 0) {
      const avg = endorsementRows.reduce((s, e) => s + e.severityLevel, 0) / endorsementRows.length;
      section(`Expert Endorsements (${endorsementRows.length}, average severity ${avg.toFixed(1)})`);
      for (const e of endorsementRows) {
        write(`- ${e.expertName || 'Expert'}: severity ${e.severityLevel} (${formatPdfDate(e.createdAt)})`, { size: 10 });
        if (e.note) write(e.note, { size: 9, color: [0.4, 0.4, 0.4], indent: 12 });
      }
    }

    if (historyRows.length > 0) {
      section('Status Timeline');
      for (const h of [...historyRows].reverse()) {
        write(`${formatPdfDate(h.createdAt, true)}: ${h.fromStatus || 'new'} -> ${h.toStatus}`, { size: 10 });
        if (h.note) write(h.note, { size: 9, color: [0.4, 0.4, 0.4], indent: 12 });
      }
    }

    if (commentRows.length > 0) {
      section(`Comments (latest ${commentRows.length})`);
      for (const c of commentRows) {
        write(`${c.userName || 'User'} - ${formatPdfDate(c.createdAt)}`, { size: 10, bold: true });
        write(c.body, { size: 9, indent: 12 });
        y -= 4;
      }
    }

    const generated = formatPdfDate(new Date(), true);
    const pages = pdfDoc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Generated ${generated} - Page ${i + 1} of ${pages.length}`, {
        x: MARGIN,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    const pdfBytes = await pdfDoc.save();
    const filename = `incident-${report.referenceNo || id}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_');

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return serverError(error, 'reports/[id]/pdf');
  }
}
