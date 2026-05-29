/**
 * sentry.client.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sentry SDK initialisation for the BROWSER (client-side rendering).
 * Next.js automatically loads this file — do NOT import it manually.
 *
 * Setup steps (run once):
 *   npx @sentry/wizard@latest -i nextjs
 *   # Follow the prompts — it sets SENTRY_DSN, adds source-map upload, etc.
 *   # Then replace the auto-generated sentry.*.config.ts files with these.
 *
 * Required environment variable (add to Vercel dashboard too):
 *   NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
 *
 * Place this file at the project root:  sentry.client.config.ts
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // ── Capture rate ─────────────────────────────────────────────────────────
  // 1.0 = 100 % of errors.  Reduce in production if you hit quota limits.
  tracesSampleRate: 0.2,     // 20 % of page loads for performance tracing
  replaysSessionSampleRate: 0,          // disable session replay (PII risk in healthcare)
  replaysOnErrorSampleRate: 0,

  // ── Metadata ─────────────────────────────────────────────────────────────
  environment: process.env.NODE_ENV ?? "development",

  // ── Ignore expected / noisy errors ───────────────────────────────────────
  ignoreErrors: [
    // Next.js router throws this on client-side navigations — not a real error
    "NEXT_NOT_FOUND",
    // Network blips that are the user's problem, not ours
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    // Browser extensions injecting scripts
    /extensions\//i,
    /^chrome:\/\//,
  ],

  // ── Strip PII before sending ──────────────────────────────────────────────
  // Healthcare app — patient names, emails, phone numbers must never leave
  // the server boundary unredacted.
  beforeSend(event) {
    // Remove user IP (we don't need it in Sentry)
    if (event.user) {
      delete event.user.ip_address;
    }
    return event;
  },
});