/**
 * src/lib/logger.ts
 * Structured, level-aware logger for production use.
 *
 * PRODUCTION FIX: Replaces scattered console.log / console.error calls
 * across API routes with a single logger that:
 *  - Respects LOG_LEVEL env var (error | warn | info | debug)
 *  - Strips patient PII from info/debug logs in production
 *  - Emits structured JSON on Vercel (LOG_FORMAT=json) for easy log queries
 *  - Falls back to human-readable format in local dev
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("[Cron] Job started", { appointmentCount: 12 });
 *   logger.error("[Auth] Failed", { reason: err.message });   // no stack in prod
 */

type LogLevel = "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn:  1,
  info:  2,
  debug: 3,
};

function getConfiguredLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LEVELS[raw] ?? LEVELS.info;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function useJson(): boolean {
  return process.env.LOG_FORMAT === "json" || isProd();
}

/**
 * Sanitize a metadata object so patient PII never reaches Vercel log drain
 * in production. Strips keys whose names contain common PII tokens.
 */
const PII_KEYS = /name|email|phone|dob|address|password/i;

function sanitize(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  if (!isProd()) return meta; // Full detail in development

  return Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [
      k,
      PII_KEYS.test(k) ? "[redacted]" : v,
    ])
  );
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] > getConfiguredLevel()) return;

  const clean = sanitize(meta);

  if (useJson()) {
    const entry: Record<string, unknown> = {
      ts:    new Date().toISOString(),
      level,
      msg:   message,
    };
    if (clean && Object.keys(clean).length > 0) entry.meta = clean;

    // eslint-disable-next-line no-console
    const fn = level === "error" ? console.error
             : level === "warn"  ? console.warn
             : console.log;
    fn(JSON.stringify(entry));
  } else {
    const ts  = new Date().toISOString();
    const tag = `[${level.toUpperCase()}]`;
    const suffix = clean ? ` ${JSON.stringify(clean)}` : "";
    // eslint-disable-next-line no-console
    const fn = level === "error" ? console.error
             : level === "warn"  ? console.warn
             : console.log;
    fn(`${ts} ${tag} ${message}${suffix}`);
  }
}

export const logger = {
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit("warn",  msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => emit("info",  msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
};
