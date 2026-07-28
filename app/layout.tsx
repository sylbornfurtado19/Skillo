import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import '../src/index.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
});

export const metadata: Metadata = {
  title: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
  description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
  openGraph: {
    title: 'Skillo | Intelligent Resume Screening & AI Interview Assistant',
    description: 'Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.',
    type: 'website',
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
