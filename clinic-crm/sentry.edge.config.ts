/**
 * sentry.edge.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sentry SDK initialisation for the EDGE RUNTIME (middleware.ts).
 * Next.js automatically loads this file — do NOT import it manually.
 *
 * Place this file at the project root:  sentry.edge.config.ts
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Lower sample rate on edge — middleware runs on every request
  tracesSampleRate: 0.05,

  environment: process.env.NODE_ENV ?? "development",
});