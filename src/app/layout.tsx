import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FixMyDistrict',
  description: 'Report and track infrastructure failures in your district.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'FixMyDistrict',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
