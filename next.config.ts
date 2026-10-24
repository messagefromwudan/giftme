import type { NextConfig } from "next";

// script.google.com: the launch RSVP form posts to Google Apps Script.
// fonts.googleapis.com / gstatic: the RSVP page loads its own Google Fonts.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://va.vercel-scripts.com",
  "form-action 'self' https://script.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    // Microphone/camera stay allowed for our own origin: the QR message recorder needs them.
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  trailingSlash: true,
  // Pages get their trailing-slash redirect in src/proxy.ts. APIs must answer at the exact path:
  // many HTTP clients used by AI agents don't follow a 308 on POST.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  experimental: {
    // The build cache served stale Tailwind CSS after edits to globals.css; builds are fast without it.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/confirma-prezenta/giftme-lansare.ics",
        headers: [{ key: "Content-Type", value: "text/calendar; charset=utf-8" }],
      },
      {
        source: "/confirma-prezenta/assets/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
  async redirects() {
    // URLs of the first static site, still shared on social media and in the RSVP page.
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/despre.html", destination: "/#despre", permanent: true },
      { source: "/servicii.html", destination: "/#cutii", permanent: true },
      { source: "/contacte.html", destination: "/#contact", permanent: true },
      { source: "/cutii/", destination: "/#cutii", permanent: false },
      { source: "/en/cutii/", destination: "/en/#cutii", permanent: false },
    ];
  },
  async rewrites() {
    // The RSVP page is plain static HTML in /public; serve its index for the folder URL.
    return {
      beforeFiles: [
        { source: "/confirma-prezenta/", destination: "/confirma-prezenta/index.html" },
      ],
    };
  },
};

export default nextConfig;
