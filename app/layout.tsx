import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import '../src/index.css';
import Providers from './providers';
import { validateEnvironment, getServerEnv } from '@/lib/server/env';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const viewport: Viewport = {
  themeColor: '#9B2218',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://skillo-theta.vercel.app'),
  title: {
    default: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
    template: '%s | Skillo',
  },
  description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
    description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
    url: 'https://skillo-theta.vercel.app',
    siteName: 'Skillo',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Skillo AI Interview Assistant',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
    description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
    images: ['/og.png'],
  },
};

const themeInitScript = `(function() {
  try {
    var saved = localStorage.getItem('iq_theme');
    if (saved) {
      try { saved = JSON.parse(saved); } catch (e) {}
      if (saved) {
        document.documentElement.dataset.theme = saved;
        document.documentElement.setAttribute('data-theme', saved);
      }
    }
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate and capture server environment during root server-side layout execution
  if (process.env.NODE_ENV !== 'test') {
    validateEnvironment();
    getServerEnv();
  }

  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-[var(--bg-page)] text-[var(--text-primary)] min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
