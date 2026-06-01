/**
 * next.config.ts
 *
 * FIX 1: NEXT_PUBLIC_APP_URL had a hardcoded placeholder fallback
 *         ("https://your-app.vercel.app") which would appear verbatim in the
 *         CSP connect-src header if the env var was not set, breaking API
 *         calls from the browser in production.
 *         Now: no fallback — the env var is required (see envValidation.ts).
 *         connect-src always includes 'self' so the app still works even if
 *         NEXT_PUBLIC_APP_URL is omitted during local dev.
 *
 * FIX 2: CSP script-src fell back to 'unsafe-inline' when nonce was absent
 *         (i.e. for the static headers applied by next.config itself).
 *         Now: the static fallback uses 'strict-dynamic' without a nonce,
 *         which is safe and still allows script loading via trusted scripts.
 */

import type { NextConfig } from "next";

// Only include the app's own domain in connect-src when the env var is set.
const appDomain = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
const isDev = process.env.NODE_ENV !== "production";

export function buildCsp(nonce?: string): string {
  // In dev: allow eval for Next.js HMR.
  // In prod with nonce: strict-dynamic; trusted scripts can load others.
  // In prod without nonce (static header): strict-dynamic without nonce.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
    : nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'strict-dynamic'`;

  // Build connect-src: always include 'self'; add app domain only when set.
  const extraConnect = appDomain ? ` ${appDomain}` : "";
  const connectSrc = `connect-src 'self'${extraConnect} https://*.vercel.app`;

  return [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    connectSrc,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

const staticSecurityHeaders = [
  { key: "Strict-Transport-Security",  value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options",            value: "DENY" },
  { key: "X-Content-Type-Options",     value: "nosniff" },
  { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control",     value: "on" },
  { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy",    value: buildCsp() },
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
