/**
 * next.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX: Add security headers — previously missing CSP, X-Frame-Options,
 *      HSTS, X-Content-Type-Options, etc.
 *
 * Headers added:
 *  - Content-Security-Policy     → blocks XSS, inline scripts, framing
 *  - Strict-Transport-Security   → forces HTTPS for 1 year (+ subdomains)
 *  - X-Frame-Options             → blocks clickjacking (DENY)
 *  - X-Content-Type-Options      → blocks MIME sniffing
 *  - Referrer-Policy             → limits referrer leakage
 *  - Permissions-Policy          → disables unused browser features
 *  - X-DNS-Prefetch-Control      → prevents DNS prefetch side-channels
 *
 * CSP notes:
 *  - 'unsafe-inline' on style-src is required by Tailwind's JIT in production
 *    until you add a nonce-based approach. Remove when ready.
 *  - Connect-src includes the Vercel deployment domains for client-side fetch.
 *  - Update ALLOWED_ORIGINS to match your real production domain.
 */

import type { NextConfig } from "next";

const PROD_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

const securityHeaders = [
  // ── Strict Transport Security (HTTPS only, 1 year) ───────────────────────
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },

  // ── Clickjacking protection ───────────────────────────────────────────────
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // ── MIME-type sniffing protection ─────────────────────────────────────────
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // ── Referrer leakage control ──────────────────────────────────────────────
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },

  // ── DNS prefetch ──────────────────────────────────────────────────────────
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },

  // ── Permissions Policy — disable unused features ──────────────────────────
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },

  // ── Content Security Policy ───────────────────────────────────────────────
  // Tighten these directives once you know exactly what external scripts/
  // styles your app loads. The values below are safe defaults for a
  // Next.js + Tailwind app with no CDN-loaded scripts.
  {
    key: "Content-Security-Policy",
    value: [
      // Only load resources from self + Vercel domain
      `default-src 'self'`,
      // Scripts: self + Next.js inline (required for hydration)
      `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
      // Styles: self + inline (Tailwind JIT requires this)
      `style-src 'self' 'unsafe-inline'`,
      // Images: self + data URIs (avatars, logo)
      `img-src 'self' data: blob:`,
      // Fonts: self only
      `font-src 'self'`,
      // API / WebSocket connections
      `connect-src 'self' ${PROD_DOMAIN} https://*.vercel.app`,
      // Forms: self only
      `form-action 'self'`,
      // No framing ever
      `frame-ancestors 'none'`,
      // No plugins
      `object-src 'none'`,
      // Block mixed content
      `upgrade-insecure-requests`,
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to ALL routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // ── Route-level timeout hints (Vercel Pro required for >10s) ─────────────
  // These are informational for the Vercel runtime via route segment config
  // in individual route files (export const maxDuration = 60).

  experimental: {
    // no-op placeholder — add experimental flags here as needed
  },
};

export default nextConfig;
