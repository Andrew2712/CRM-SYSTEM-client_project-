/**
 * src/lib/envValidation.ts
 * Call validateEnv() at the top of any critical API route.
 * Fails fast with a clear error rather than a cryptic runtime crash.
 *
 * FIX: Added UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to the
 * required list. They were previously optional, meaning a production
 * misconfiguration silently fell back to the in-process rate limiter
 * (which is NOT shared across Vercel serverless instances).
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
    // Optional: override app URL for CSP connect-src (set to your real domain)
    "NEXT_PUBLIC_APP_URL",
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
}
