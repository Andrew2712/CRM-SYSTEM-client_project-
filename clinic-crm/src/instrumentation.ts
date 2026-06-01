/**
 * src/instrumentation.ts
 * Next.js server-side instrumentation (Node.js runtime).
 *
 * FIX: Was an empty stub — Sentry was installed but never initialised,
 * meaning no server errors were captured in production.
 *
 * This file is loaded once when the Next.js server boots.
 * DSN is read from SENTRY_DSN env var; if unset, Sentry is a no-op.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Only initialise when DSN is present (skips local dev without .env)
      enabled: !!process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? "development",
      // Capture 10 % of transactions for performance tracing
      tracesSampleRate: 0.1,
      // Don't send PII to Sentry
      sendDefaultPii: false,
    });
  }
}
