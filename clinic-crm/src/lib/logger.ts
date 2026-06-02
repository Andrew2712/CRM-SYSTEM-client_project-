/**
 * src/lib/logger.ts
 *
 * Structured JSON logger with Sentry integration for production.
 *
 * ROOT CAUSE OF "Type 'object' is not assignable to type 'Extras'":
 *   Sentry's captureMessage() extra field expects `Extras` which is typed as
 *   `Record<string, unknown>` — it does NOT accept the wide `object` type because
 *   `object` has no index signature. Fix: narrow the `meta` parameter type from
 *   `object` to `Record<string, unknown>` throughout.
 *
 * USAGE:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Appointment created", { appointmentId, patientId });
 *   logger.warn("Rate limit close", { remaining: 2, ip });
 *   logger.error("DB write failed", { error: err.message, route: "/api/appointments" });
 *   logger.debug("Raw payload", { body });  // suppressed in production
 *
 * LOG DRAIN:
 *   Vercel captures stdout/stderr and forwards JSON lines to any connected
 *   log drain (Axiom, Logtail, Datadog, etc.) automatically.
 *   See: https://vercel.com/docs/observability/log-drains
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type LogLevel = "info" | "warn" | "error" | "debug";

// Must be Record<string, unknown> (not `object`) so it satisfies Sentry's
// Extras index signature and remains compatible with JSON.stringify spread.
type Meta = Record<string, unknown>;

type LogEntry = {
  level:     LogLevel;
  message:   string;
  timestamp: string;
  env:       string;
} & Meta;

// ── Constants ─────────────────────────────────────────────────────────────────

const ENV     = process.env.NODE_ENV ?? "development";
const IS_PROD = ENV === "production";

// ── Sentry capture (lazy import — respects Sentry init order) ─────────────────

async function captureToSentry(message: string, meta: Meta): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    // Sentry.captureMessage extra must be Record<string, unknown> — Meta satisfies this.
    Sentry.captureMessage(message, {
      level: "error",
      extra: meta,
    });
  } catch {
    // Never let Sentry failure break the logger
  }
}

// ── Core emit ─────────────────────────────────────────────────────────────────

function emit(level: LogLevel, message: string, meta: Meta = {}): void {
  // Suppress debug logs in production
  if (level === "debug" && IS_PROD) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    env: ENV,
    ...meta,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      // Fire-and-forget Sentry capture in production
      if (IS_PROD) void captureToSentry(message, meta);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const logger = {
  /**
   * Normal operational events.
   * Example: logger.info("Appointment created", { appointmentId, patientId })
   */
  info: (message: string, meta?: Meta) => emit("info", message, meta),

  /**
   * Unexpected but non-fatal conditions.
   * Example: logger.warn("WhatsApp delivery failed", { phone, error })
   */
  warn: (message: string, meta?: Meta) => emit("warn", message, meta),

  /**
   * Errors that affect a request or job. Also captured to Sentry in production.
   * Example: logger.error("DB write failed", { error: err.message, route })
   */
  error: (message: string, meta?: Meta) => emit("error", message, meta),

  /**
   * Verbose diagnostics — suppressed in production.
   * Example: logger.debug("Raw request body", { body })
   */
  debug: (message: string, meta?: Meta) => emit("debug", message, meta),
};

export default logger;
