import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import '../src/index.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
  description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
  openGraph: {
    title: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
    description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
    url: 'https://skillo-theta.vercel.app',
    siteName: 'Skillo',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&h=630&q=80',
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
    images: ['https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&h=630&q=80'],
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-[#030712] text-gray-100 min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
