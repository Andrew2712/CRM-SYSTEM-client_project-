/**
 * src/lib/envValidation.ts
 * Call validateEnv() at the top of any critical API route.
 * Fails fast with a clear error rather than a cryptic runtime crash.
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
  ],
  optional: [
    "DEV_TEST_EMAIL",
    "DEV_TEST_PHONE",
    "NODE_ENV",
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