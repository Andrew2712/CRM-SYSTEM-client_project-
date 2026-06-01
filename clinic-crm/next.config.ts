import type { NextConfig } from "next";

// buildCsp is kept for reference / dev use only.
// In production, the CSP with a per-request nonce is set in middleware.ts.
export function buildCsp(nonce?: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const PROD_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
    : nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'unsafe-inline'`;

  return [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${PROD_DOMAIN} https://*.vercel.app`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

// Only static, non-CSP security headers live here.
// The Content-Security-Policy header is set per-request in middleware.ts
// because it needs a unique nonce each time.
const staticSecurityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
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