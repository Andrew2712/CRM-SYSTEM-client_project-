/**
 * src/lib/whatsapp.ts
 *
 * Uses Meta WhatsApp Cloud API directly.
 *
 * WHAT CHANGED — template rejection fallback:
 *   The old sendWhatsAppTemplate() threw on any non-200 response, including
 *   Meta error 132000 (template not found / pending approval) and 132001
 *   (template paused). In production this meant a single unapproved template
 *   would crash the entire notification workflow for that appointment.
 *
 *   Now sendWhatsAppTemplate() distinguishes between:
 *     - Retryable errors (network, 5xx)  → 3 attempts with back-off
 *     - Template errors (130472, 132000, 132001, 132015) → log + return,
 *       do NOT re-throw. The caller continues; the appointment is not lost.
 *   sendWhatsApp() (free-form) behaviour is unchanged.
 *
 * Required env vars:
 *   META_WA_TOKEN              — Permanent system user token
 *   META_WA_PHONE_ID           — Phone Number ID from Meta dashboard
 *   META_WA_TEMPLATE_BOOKING   — Approved booking-confirmation template name
 *   META_WA_TEMPLATE_REMINDER  — Approved reminder template name
 *   META_WA_TEMPLATE_MISSED    — Approved missed-session template name
 */

import { logger } from "@/lib/logger";

// ─── Phone normalisation ───────────────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

// ─── Meta error codes that mean "template problem — don't retry/throw" ────────

const TEMPLATE_ERROR_CODES = new Set([
  130472, // Outside 24h customer service window — template required
  132000, // Template not found or not approved yet
  132001, // Template paused by Meta
  132015, // Template rejected
]);

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function metaPost(phoneId: string, token: string, body: object): Promise<{
  ok: boolean;
  msgId?: string;
  errorCode?: number;
  errorMsg?: string;
}> {
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as {
    messages?: { id: string }[];
    error?: { message: string; code: number; error_subcode?: number };
  };

  if (!res.ok || data.error) {
    return {
      ok: false,
      errorCode: data.error?.code,
      errorMsg:  data.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return { ok: true, msgId: data.messages?.[0]?.id };
}

// ─── sendWhatsApp — free-form (24h window only) ───────────────────────────────

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const phoneId = process.env.META_WA_PHONE_ID;
  const token   = process.env.META_WA_TOKEN;

  if (!phoneId || !token) {
    throw new Error(
      "[WhatsApp] META_WA_PHONE_ID or META_WA_TOKEN is not set. " +
      "Get these from Meta Business Manager → WhatsApp → API Setup."
    );
  }

  const normalised = normalizePhone(to);
  if (!normalised || normalised.length < 10) {
    logger.warn("[WhatsApp] Skipping invalid phone", { raw: to });
    return;
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalised,
    type: "text",
    text: { preview_url: false, body: message },
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await metaPost(phoneId, token, body);

      if (!result.ok) {
        if (result.errorCode === 130472) {
          logger.warn("[WhatsApp] 130472 — outside 24h window, use template", { to: normalised });
          return;
        }
        throw new Error(`Meta API error (${result.errorCode}): ${result.errorMsg}`);
      }

      logger.info("[WhatsApp] Sent", { to: normalised, msgId: result.msgId, attempt });
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[WhatsApp] Attempt ${attempt}/3 failed`, { to: normalised, error: lastError.message });
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  throw new Error(`[WhatsApp] All 3 attempts failed for ${normalised}. Last: ${lastError?.message}`);
}

// ─── sendWhatsAppTemplate — with template-rejection fallback ──────────────────

/**
 * Send an approved Meta template message.
 *
 * Template errors (not found, paused, rejected, outside window) are logged
 * and swallowed — they do NOT throw. This keeps the notification workflow
 * moving even if one template has an issue.
 *
 * Network and 5xx errors ARE retried (3 attempts).
 *
 * @param to           Recipient phone
 * @param templateName Approved template name in Meta Business Manager
 * @param langCode     Template language code (default: "en")
 * @param components   Template variable components
 * @returns            true if sent, false if skipped due to template error
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  langCode = "en",
  components: object[] = []
): Promise<boolean> {
  const phoneId = process.env.META_WA_PHONE_ID;
  const token   = process.env.META_WA_TOKEN;

  if (!phoneId || !token) {
    throw new Error("[WhatsApp] META_WA_PHONE_ID or META_WA_TOKEN is not set.");
  }

  const normalised = normalizePhone(to);
  const body = {
    messaging_product: "whatsapp",
    to: normalised,
    type: "template",
    template: {
      name: templateName,
      language: { code: langCode },
      components,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await metaPost(phoneId, token, body);

      if (!result.ok) {
        // Template-level errors: log and return false — do NOT re-throw
        if (result.errorCode && TEMPLATE_ERROR_CODES.has(result.errorCode)) {
          logger.warn("[WhatsApp Template] Template error — skipping, not retrying", {
            to: normalised,
            template: templateName,
            errorCode: result.errorCode,
            errorMsg: result.errorMsg,
            hint:
              result.errorCode === 132000
                ? "Template not found or pending approval in Meta Business Manager"
                : result.errorCode === 132001
                ? "Template is paused — check Meta Business Manager"
                : result.errorCode === 132015
                ? "Template was rejected by Meta"
                : "Outside 24h window — template send attempted correctly",
          });
          return false;
        }

        throw new Error(`Meta API error (${result.errorCode}): ${result.errorMsg}`);
      }

      logger.info("[WhatsApp Template] Sent", {
        to: normalised,
        template: templateName,
        msgId: result.msgId,
        attempt,
      });
      return true;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[WhatsApp Template] Attempt ${attempt}/3 failed`, {
        to: normalised,
        template: templateName,
        error: lastError.message,
      });
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  // All retries exhausted — this is a network/infra error, re-throw
  throw new Error(
    `[WhatsApp Template] All 3 attempts failed for ${normalised} (template: ${templateName}). ` +
    `Last: ${lastError?.message}`
  );
}

// ─── Message body builders ────────────────────────────────────────────────────

export function bookingConfirmedPatientMsg(
  patientName: string,
  doctorName: string,
  dateTimeIST: string
): string {
  return (
    `Hello ${patientName} 👋\n\n` +
    `✅ *Appointment Confirmed!*\n` +
    `📋 Doctor: ${doctorName}\n` +
    `🕐 Date & Time (IST): ${dateTimeIST}\n\n` +
    `Please arrive 10 minutes early.\n\n` +
    `— Vyayama Physio`
  );
}

export function bookingConfirmedDoctorMsg(
  doctorName: string,
  patientName: string,
  dateTimeIST: string
): string {
  return (
    `Hello ${doctorName} 👋\n\n` +
    `📅 *New Appointment Booked*\n` +
    `👤 Patient: ${patientName}\n` +
    `🕐 Date & Time (IST): ${dateTimeIST}\n\n` +
    `— Vyayama Physio`
  );
}

export function reminder24hMsg(
  patientName: string,
  doctorName: string,
  dateTimeIST: string
): string {
  return (
    `Hello ${patientName} 👋\n\n` +
    `⏰ *Appointment Reminder — 24 Hours*\n` +
    `Your appointment with ${doctorName} is tomorrow.\n` +
    `🕐 Time (IST): ${dateTimeIST}\n\n` +
    `— Vyayama Physio`
  );
}

export function reminder2hMsg(
  patientName: string,
  doctorName: string,
  dateTimeIST: string
): string {
  return (
    `Hello ${patientName} 👋\n\n` +
    `⏰ *Appointment Reminder — 2 Hours*\n` +
    `Your appointment with ${doctorName} is soon!\n` +
    `🕐 Time (IST): ${dateTimeIST}\n\n` +
    `— Vyayama Physio`
  );
}

export function missedSessionPatientMsg(
  patientName: string,
  doctorName: string,
  dateTimeIST: string
): string {
  return (
    `Hello ${patientName} 👋\n\n` +
    `❌ *Missed Appointment*\n` +
    `We noticed you missed your appointment with ${doctorName} at ${dateTimeIST} (IST).\n\n` +
    `Please contact us to reschedule.\n\n` +
    `— Vyayama Physio`
  );
}
