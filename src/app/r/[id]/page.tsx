import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicReport } from '@/lib/public-report';
import ShareSheet from '@/components/ShareSheet';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await getPublicReport(id);
  if (!report) return { title: 'Report not found · FixMyDistrict' };

  const description =
    report.description?.slice(0, 160) ||
    `${report.category || 'Infrastructure'} report in FixMyDistrict`;

  return {
    title: `${report.title} · FixMyDistrict`,
    description,
    openGraph: {
      title: report.title,
      description,
      type: 'article',
      images: report.imageUrl ? [{ url: report.imageUrl }] : undefined,
    },
    twitter: {
      card: report.imageUrl ? 'summary_large_image' : 'summary',
      title: report.title,
      description,
      images: report.imageUrl ? [report.imageUrl] : undefined,
    },
  };
}

export default async function PublicReportPage({ params }: Props) {
  const { id } = await params;
  const report = await getPublicReport(id);
  if (!report) notFound();

  const sharePath = `/r/${report.id}`;

  return (
    <div className="public-page">
      <header className="public-topbar">
        <Link href="/" className="public-brand">
          <img src="/logo.svg" alt="" width={28} height={28} />
          FixMyDistrict
        </Link>
        <div className="public-topbar-actions">
          <Link href="/public" className="btn-secondary btn-sm">Browse reports</Link>
          <Link href="/login" className="btn-primary btn-sm">Sign in</Link>
        </div>
      </header>

      <main className="public-report">
        <p className="report-ref">{report.referenceNo}</p>
        <h1>{report.title}</h1>
        <div className="report-meta-row">
          <span className="report-badge submitted">{report.status.replace(/_/g, ' ')}</span>
          {(report.infrastructureClass || report.category) && (
            <span className="report-category">
              {report.infrastructureClass || report.category}
              {(report.infrastructureType || report.subcategory)
                ? ` · ${report.infrastructureType || report.subcategory}`
                : ''}
            </span>
          )}
          {report.severity != null && (
            <span className={`sev-chip ${report.severity >= 4 ? 'sev-high' : report.severity === 3 ? 'sev-med' : 'sev-low'}`}>
              Severity {report.severity}
            </span>
          )}
        </div>
        <p className="public-byline">
          Reported by {report.userDisplayName || 'Community member'} ·{' '}
          {new Date(report.createdAt).toLocaleDateString()}
        </p>

        {report.description && <p className="public-desc">{report.description}</p>}

        {report.imageUrl && (
          <img src={report.imageUrl} alt="" className="public-media" />
        )}
        {report.videoUrl && (
          <video src={report.videoUrl} controls className="public-media" />
        )}
        {report.audioUrl && (
          <audio src={report.audioUrl} controls className="public-audio" />
        )}

        {report.aiSummary && (
          <aside className="public-ai-summary">
            <strong>Summary</strong>
            <p>{report.aiSummary}</p>
          </aside>
        )}

        <p className="public-coords">
          Location: {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
        </p>

        <div className="public-actions">
          <ShareSheet
            urlPath={sharePath}
            title={report.title}
            text={`Check out this FixMyDistrict report: ${report.title}`}
          />
          <Link href={`/login?redirect=/dashboard/reports/${report.id}`} className="btn-primary">
            Sign in to upvote or comment
          </Link>
        </div>
      </main>
    </div>
  );
}
