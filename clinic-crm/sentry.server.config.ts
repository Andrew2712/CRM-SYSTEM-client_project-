/**
 * sentry.server.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sentry SDK initialisation for the NODE.JS SERVER (API routes, RSC, cron).
 * Next.js automatically loads this file — do NOT import it manually.
 *
 * Required environment variable (server-only — do NOT use NEXT_PUBLIC_ prefix):
 *   SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
 *   SENTRY_ORG=your-sentry-org-slug
 *   SENTRY_PROJECT=your-project-slug
 *   SENTRY_AUTH_TOKEN=sntrys_...   (for source-map upload during build)
 *
 * Place this file at the project root:  sentry.server.config.ts
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // ── Capture rate ─────────────────────────────────────────────────────────
  tracesSampleRate: 0.1,   // 10 % of server-side requests for performance tracing

  // ── Metadata ─────────────────────────────────────────────────────────────
  environment: process.env.NODE_ENV ?? "development",

  // ── PII / data scrubbing ──────────────────────────────────────────────────
  // Sentry's default scrubber strips "password", "secret", etc.
  // Add clinic-specific fields here.
  beforeSend(event) {
    // Strip any accidental inclusion of patient phone numbers in breadcrumbs
    if (event.breadcrumbs?.values) {
      event.breadcrumbs.values = event.breadcrumbs.values.map(b => {
        if (b.data?.phone) b.data.phone = "[redacted]";
        if (b.data?.email) b.data.email = "[redacted]";
        return b;
      });
    }
    // Remove user IP
    if (event.user) {
      delete event.user.ip_address;
    }
    return event;
  },
});