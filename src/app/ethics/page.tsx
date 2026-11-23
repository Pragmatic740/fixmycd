import type { Metadata } from 'next';
import Link from 'next/link';
import { EthicsText } from '@/components/EthicsText';
import { getCurrentEthics } from '@/lib/ethics';

export const metadata: Metadata = { title: 'Code of Ethics · FixMyDistrict' };
// Always show the newest published version.
export const dynamic = 'force-dynamic';

export default async function EthicsPage() {
  const ethics = await getCurrentEthics();
  return (
    <main className="ethics-page">
      <Link href="/" className="auth-logo">
        <img src="/logo.svg" alt="FixMyDistrict" />
        <span>FixMyDistrict</span>
      </Link>
      <EthicsText body={ethics.body} />
      <p className="ethics-version">
        Version {ethics.version}
        {ethics.publishedAt ? ` · published ${new Date(ethics.publishedAt).toISOString().slice(0, 10)}` : ''}
      </p>
      <p>
        <Link href="/signup" className="btn-primary">
          Join FixMyDistrict
        </Link>
      </p>
    </main>
  );
}
