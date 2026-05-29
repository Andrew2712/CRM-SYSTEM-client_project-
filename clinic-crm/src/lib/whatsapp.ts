/**
 * src/lib/whatsapp.ts
 * 
 * Uses Meta WhatsApp Cloud API directly (not Twilio).
 * Cheaper, faster approval, and you already have a WhatsApp Business account.
 * 
 * Required env vars:
 *   META_WA_TOKEN          — Permanent system user token from Meta Business Manager
 *   META_WA_PHONE_ID       — Phone Number ID from Meta WhatsApp Business dashboard
 *   META_WA_TEMPLATE_*     — Template names (approved in Meta Business Manager)
 */

/**
 * Normalise a phone number to E.164 for Indian numbers.
 * Meta Cloud API requires E.164 WITHOUT the leading +
 * e.g. "9876543210" → "919876543210"
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) return digits; // strip the + for Meta API

  // 10-digit Indian mobile (starts with 6-9)
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }

  // Already has 91 prefix: 12 digits starting with 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return digits;
}

/**
 * Send a free-form WhatsApp message via Meta Cloud API.
 *
 * IMPORTANT: Free-form messages can only be sent within the 24-hour
 * customer service window (after the patient last messaged you).
 * For outbound-initiated notifications (like booking confirmations
 * to new patients), you MUST use approved message templates.
 * See sendWhatsAppTemplate() below.
 *
 * @param to      Recipient phone — any reasonable Indian format
 * @param message Plain-text message body
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const phoneId = process.env.META_WA_PHONE_ID;
  const token = process.env.META_WA_TOKEN;

  if (!phoneId || !token) {
    throw new Error(
      "[WhatsApp] META_WA_PHONE_ID or META_WA_TOKEN is not set. " +
      "Get these from Meta Business Manager → WhatsApp → API Setup."
    );
  }

  const normalised = normalizePhone(to);
  if (!normalised || normalised.length < 10) {
    console.warn(`[WhatsApp] Skipping invalid phone: "${to}"`);
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
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
        const errMsg = data.error?.message ?? `HTTP ${res.status}`;
        const code = data.error?.code;

        // 130472 = Outside 24h window — must use template
        if (code === 130472) {
          console.warn(
            `[WhatsApp] 130472 — ${normalised} is outside the 24h customer service window. ` +
            `Use sendWhatsAppTemplate() for outbound-initiated messages.`
          );
          return; // Not retryable — template required
        }

        throw new Error(`Meta API error (${code}): ${errMsg}`);
      }

      const msgId = data.messages?.[0]?.id;
      console.log(`[WhatsApp] Sent ✓ | to=${normalised} | msgId=${msgId} | attempt=${attempt}`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[WhatsApp] Attempt ${attempt}/3 failed for ${normalised}: ${lastError.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  throw new Error(`[WhatsApp] All 3 attempts failed for ${normalised}. Last: ${lastError?.message}`);
}

/**
 * Send an approved template message (for outbound-initiated notifications).
 * Required for: booking confirmations, reminders, missed session alerts.
 *
 * @param to           Recipient phone
 * @param templateName Approved template name in Meta Business Manager
 * @param langCode     Template language code (default: "en")
 * @param components   Template variable components (body parameters)
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  langCode = "en",
  components: object[] = []
): Promise<void> {
  const phoneId = process.env.META_WA_PHONE_ID;
  const token = process.env.META_WA_TOKEN;

  if (!phoneId || !token) {
    throw new Error("[WhatsApp] META_WA_PHONE_ID or META_WA_TOKEN is not set.");
  }

  const normalised = normalizePhone(to);
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: { id: string }[]; error?: { message: string } };

  if (!res.ok || data.error) {
    throw new Error(`[WhatsApp Template] Meta API error: ${data.error?.message ?? res.status}`);
  }

  console.log(`[WhatsApp Template] Sent ✓ | to=${normalised} | template=${templateName}`);
}

// ─── Message body builders (unchanged — used for free-form/session window) ────

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