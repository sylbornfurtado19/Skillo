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
  async redirects() {
    return [
      {
        source: '/ivp-lab',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
  async headers() {
    // Firebase Auth loads scripts and iframes from Google at sign-in time: reCAPTCHA Enterprise
    // (email/password protection), gapi for signInWithPopup, and the auth handler iframe on the
    // authDomain. If CSP blocks any of them the SDK only reports auth/internal-error.
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const firebaseFrameSources = [
      'https://*.firebaseapp.com',
      'https://*.web.app',
      authDomain ? `https://${authDomain}` : '',
    ].filter(Boolean);

    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://apis.google.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
      `frame-src 'self' ${firebaseFrameSources.join(' ')} https://www.google.com https://recaptcha.google.com https://www.recaptcha.net`,
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com https://lh3.googleusercontent.com https://www.gstatic.com",
      "connect-src 'self' blob: https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: cspHeader },
        ],
      },
      {
        source: '/wasm/:path*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/wasm/:path*.mjs',
        headers: [
          { key: 'Content-Type', value: 'text/javascript' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/wasm/:path*.js',
        headers: [
          { key: 'Content-Type', value: 'text/javascript' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/wasm/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
