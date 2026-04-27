/**
 * src/lib/whatsapp.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * WhatsApp utility using Twilio WhatsApp API
 * ─────────────────────────────────────────────────────────────────────────────
 */

import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send a WhatsApp message via Twilio.
 *
 * @param to      Recipient phone number in E.164 format, e.g. "+919876543210"
 * @param message Plain-text message body
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  // Twilio requires the whatsapp: prefix on both from and to
  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const from = process.env.TWILIO_WHATSAPP_NUMBER!; // e.g. "whatsapp:+14155238886"

  await client.messages.create({
    from,
    to: formattedTo,
    body: message,
  });
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
    `📋 Doctor:  ${doctorName}\n` +
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
    `Hello Dr. ${doctorName} 👋\n\n` +
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
    `Your appointment with  ${doctorName} is scheduled for tomorrow.\n` +
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
    `Your appointment with  ${doctorName} is coming up soon!\n` +
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
    `We noticed you missed your appointment with  ${doctorName} scheduled at ${dateTimeIST} (IST).\n\n` +
    `Please contact us to reschedule your session.\n\n` +
    `— Clinic CRM`
  );
}