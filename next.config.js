/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse (pdfjs-dist) and mammoth break when bundled into server routes (pdfjs worker/DOM
  // shims fail to resolve), which crashed /api/resume/extract with a bare 500. Load them from
  // node_modules at runtime instead.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'mammoth', '@napi-rs/canvas'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
};

export default nextConfig;
