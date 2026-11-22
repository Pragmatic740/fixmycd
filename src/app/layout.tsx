import type { Metadata, Viewport } from 'next';
import { PWARegister } from '@/components/PWARegister';
import { ThemeController } from '@/components/ThemeToggle';
import { themeInitScript } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'FixMyDistrict',
  description: 'Report and track infrastructure failures in your district.',
  manifest: '/manifest.json',
  applicationName: 'FixMyDistrict',
  appleWebApp: {
    capable: true,
    title: 'FixMyDistrict',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#8b5cf6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-theme defaults to dark (the original look); the inline script swaps in the
    // saved or OS preference before the first paint, so the DOM wins over hydration.
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ThemeController />
        <PWARegister />
      </body>
    </html>
  );
}