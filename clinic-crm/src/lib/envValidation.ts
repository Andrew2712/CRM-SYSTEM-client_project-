/**
 * src/lib/envValidation.ts
 * Call validateEnv() at the top of any critical API route.
 * Fails fast with a clear error rather than a cryptic runtime crash.
 *
 * CHANGES:
 * - Added SENTRY_DSN to the optional list with a production warning when absent.
 *   Previously it wasn't listed at all, so a missing DSN in production was silent.
 */

type EnvConfig = {
  required: string[];
  optional: string[];
};

const ENV: EnvConfig = {
  required: [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "META_WA_TOKEN",
    "META_WA_PHONE_ID",
    "CRON_SECRET",
    // Rate limiting — must be distributed in production (Vercel is multi-instance)
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ],
  optional: [
    "DEV_TEST_EMAIL",
    "DEV_TEST_PHONE",
    "NODE_ENV",
    // Override app URL for CSP connect-src (set to your real domain)
    "NEXT_PUBLIC_APP_URL",
    // Error monitoring — optional but strongly recommended in production
    "SENTRY_DSN",
  ],
};

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of ENV.required) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Env] Missing required environment variables: ${missing.join(", ")}. ` +
      `Set these in Vercel Dashboard → Settings → Environment Variables.`
    );
  }

  // Warn (don't throw) when optional-but-important vars are absent in production
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SENTRY_DSN?.trim()) {
      console.warn(
        "[Env] SENTRY_DSN is not set. Server errors will not be captured in Sentry. " +
        "Set it in Vercel Dashboard → Settings → Environment Variables."
      );
    }
  }
}
