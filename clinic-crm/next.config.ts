/**
 * next.config.ts
 *
 * PRODUCTION FIX: Replaced 'unsafe-eval' and 'unsafe-inline' on script-src
 * with a nonce-based Content Security Policy.
 *
 * How it works:
 *   - generateNonce() in middleware.ts creates a unique base64 nonce per request.
 *   - The nonce is set on the response header x-nonce so layout.tsx can read it.
 *   - Next.js reads x-nonce from headers() and injects it into <Script> tags.
 *   - Only scripts with the matching nonce (or 'strict-dynamic') are allowed.
 *
 * After applying this fix, also update:
 *   1. middleware.ts — add generateNonce() and set x-nonce + CSP headers there
 *      (see the nonce middleware section in PRODUCTION-GUIDE.md)
 *   2. src/app/layout.tsx — read the nonce and pass it to <Script> tags
 *      (see the layout nonce section in PRODUCTION-GUIDE.md)
 *
 * NOTE: 'unsafe-eval' is still required in Next.js development mode.
 * This config applies the strict policy only in production.
 */

import type { NextConfig } from "next";

const PROD_DOMAIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

const isDev = process.env.NODE_ENV !== "production";

function buildCsp(nonce?: string): string {
  const scriptSrc = isDev
    // Development: allow eval for hot module reload
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
    // Production: nonce-based — no unsafe-eval, no unsafe-inline
    : nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,           // inline styles are safe (no injection risk)
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${PROD_DOMAIN} https://*.vercel.app`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

const staticSecurityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Static CSP for the next.config headers() hook (no nonce available here).
  // The per-request nonce CSP is set in middleware.ts via response headers,
  // which overrides this for actual page requests.
  {
    key: "Content-Security-Policy",
    value: buildCsp(),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: staticSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
export { buildCsp };
