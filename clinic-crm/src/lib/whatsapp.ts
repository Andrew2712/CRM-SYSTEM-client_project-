/**
 * src/lib/whatsapp.ts
 *
 * ─── WHAT CHANGED ────────────────────────────────────────────────────────────
 *
 * 1. PHONE NUMBER NORMALISATION
 *    Patient phones in the DB may be stored as "9876543210" (no country code),
 *    "+919876543210", or "919876543210". Twilio requires strict E.164 format
 *    (+[country][number]). normalizeIndianPhone() handles all three formats
 *    for Indian numbers (the clinic's primary market). Non-Indian numbers that
 *    already start with "+" are passed through unchanged.
 *
 * 2. DETAILED ERROR LOGGING
 *    Twilio errors now log the full error code and message so you can tell
 *    immediately whether a failure is:
 *      - 21408: permission to send to region not enabled
 *      - 21211: invalid 'To' phone number
 *      - 63007: sandbox opt-in required (the most common cause of silent failures)
 *      - 21606: WhatsApp-enabled number required on the 'From'
 *
 * 3. SANDBOX OPT-IN GUARD
 *    When the error is 63007 (recipient hasn't opted into sandbox), the error
 *    message tells you exactly how to fix it instead of silently swallowing it.
 *
 * ─── SANDBOX vs PRODUCTION ───────────────────────────────────────────────────
 *
 * SANDBOX (testing):
 *   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
 *   Every recipient must first send "join <your-keyword>" to that number.
 *   Free-form text works fine once opted in.
 *
 * PRODUCTION (real patients):
 *   You need a Twilio-approved WhatsApp sender number.
 *   Go to: https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders
 *   Apply for a WhatsApp Business sender. Once approved, set:
 *   TWILIO_WHATSAPP_NUMBER=whatsapp:+91XXXXXXXXXX
 *   Free-form text works for 24h after a patient messages you first.
 *   For outbound-only (clinic initiating), you need approved templates —
 *   see: https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Normalise a phone number to E.164 for Indian numbers.
 *
 * Handles:
 *   "9876543210"     → "+919876543210"
 *   "919876543210"   → "+919876543210"
 *   "+919876543210"  → "+919876543210"  (unchanged)
 *   "+1234567890"    → "+1234567890"    (non-Indian, passed through)
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, ""); // strip everything except digits

  // Already has country code (starts with +)
  if (raw.startsWith("+")) return raw;

  // Indian mobile: 10 digits starting with 6–9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }

  // Indian mobile with country code prefix: 91 + 10 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // Unknown format — prefix + and hope for the best; Twilio will error clearly
  return `+${digits}`;
}

/**
 * Send a WhatsApp message via Twilio.
 *
 * @param to      Recipient phone — any reasonable format, auto-normalised
 * @param message Plain-text message body
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const normalised  = normalizePhone(to);
  const formattedTo = normalised.startsWith("whatsapp:") ? normalised : `whatsapp:${normalised}`;
  const from        = process.env.TWILIO_WHATSAPP_NUMBER!;

  if (!from) {
    throw new Error("TWILIO_WHATSAPP_NUMBER is not set in environment variables.");
  }

  try {
    const result = await client.messages.create({
      from,
      to: formattedTo,
      body: message,
    });

    console.log(`[WhatsApp] Sent to ${formattedTo} | SID: ${result.sid} | Status: ${result.status}`);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string; status?: number };

    // Provide actionable guidance for the most common errors
    if (e?.code === 63007) {
      console.error(
        `[WhatsApp] ERROR 63007 — ${formattedTo} has not opted into the Twilio sandbox.\n` +
        `Ask them to send "join <your-sandbox-keyword>" to ${from} first.\n` +
        `In production, use an approved WhatsApp Business sender instead of the sandbox.`
      );
    } else if (e?.code === 21211) {
      console.error(`[WhatsApp] ERROR 21211 — Invalid phone number: ${formattedTo}`);
    } else if (e?.code === 21606) {
      console.error(
        `[WhatsApp] ERROR 21606 — The FROM number (${from}) is not WhatsApp-enabled.\n` +
        `Check your TWILIO_WHATSAPP_NUMBER env var includes the whatsapp: prefix.`
      );
    } else if (e?.code === 21408) {
      console.error(
        `[WhatsApp] ERROR 21408 — Your Twilio account does not have permission to send to this region.\n` +
        `Enable it at: https://console.twilio.com/us1/develop/sms/settings/geo-permissions`
      );
    } else {
      console.error(`[WhatsApp] Failed to send to ${formattedTo}:`, e?.message ?? err);
    }

    throw err; // re-throw so safeSend() can record it as FAILED
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Templates
// ─────────────────────────────────────────────────────────────────────────────

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
    `Please arrive 10 minutes early. To reschedule, contact us at least 24 hours in advance.\n\n` +
    `— Clinic CRM`
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
    `— Clinic CRM`
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
    `Your appointment with ${doctorName} is scheduled for tomorrow.\n` +
    `🕐 Time (IST): ${dateTimeIST}\n\n` +
    `Please be on time. Contact us if you need to reschedule.\n\n` +
    `— Clinic CRM`
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
    `Your appointment with ${doctorName} is coming up soon!\n` +
    `🕐 Time (IST): ${dateTimeIST}\n\n` +
    `Please head over shortly. See you soon!\n\n` +
    `— Clinic CRM`
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
    `Please contact us to reschedule your session.\n\n` +
    `— Clinic CRM`
  );
}
