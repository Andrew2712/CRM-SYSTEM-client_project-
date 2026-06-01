/**
 * src/instrumentation-client.ts
 * Next.js client-side instrumentation (browser runtime).
 *
 * FIX: Was an empty stub — no client errors were captured in production.
 *
 * This file is bundled into the browser build and runs on every page load.
 * DSN is read from NEXT_PUBLIC_SENTRY_DSN (must be NEXT_PUBLIC_ to be
 * available in the browser bundle).
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Capture 5 % of browser transactions — enough for perf insight without cost
  tracesSampleRate: 0.05,
  // Replay 1 % of sessions normally, 100 % on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
});
