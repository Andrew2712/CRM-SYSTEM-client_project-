/**
 * src/lib/email.ts
 * Production-safe email via Resend with retry + structured logging.
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("[Email] RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}

/**
 * Send an email via Resend with automatic retry on transient failures.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  maxAttempts = 3
): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error(
      "[Email] EMAIL_FROM is not set. " +
      "Set it to a Resend-verified address, e.g. 'Clinic <noreply@app.vyayamaphysio.co.in>'"
    );
  }

  if (!to || !to.includes("@")) {
    console.warn(`[Email] Skipping invalid address: "${to}"`);
    return;
  }

  const resend = getResend();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await resend.emails.send({ from, to, subject, html });

      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }

      console.log(`[Email] Sent ✓ | to=${to} | subject="${subject}" | id=${data?.id} | attempt=${attempt}`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Email] Attempt ${attempt}/${maxAttempts} failed for ${to}: ${lastError.message}`);

      if (attempt < maxAttempts) {
        // Exponential backoff: 500ms, 1000ms
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw new Error(`[Email] All ${maxAttempts} attempts failed for ${to}. Last: ${lastError?.message}`);
}

// ─── HTML Templates (unchanged) ───────────────────────────────────────────────

export function bookingConfirmedPatientHtml(
  patientName: string,
  doctorName: string,
  dateTimeIST: string
): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#1d4ed8">Appointment Confirmed ✅</h2>
      <p>Dear <strong>${patientName}</strong>,</p>
      <p>Your appointment has been successfully booked.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Doctor</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${doctorName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Date &amp; Time (IST)</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${dateTimeIST}</td></tr>
      </table>
      <p style="margin-top:16px">Please arrive 10 minutes early. To reschedule, contact us at least 24 hours in advance.</p>
      <p style="color:#6b7280;font-size:12px">Vyayama Physio — Automated Notification</p>
    </div>
  `;
}

export function bookingConfirmedDoctorHtml(
  doctorName: string,
  patientName: string,
  dateTimeIST: string
): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#1d4ed8">New Appointment Booked 📅</h2>
      <p>Dear <strong>${doctorName}</strong>,</p>
      <p>A new appointment has been scheduled for you.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Patient</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${patientName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Date &amp; Time (IST)</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${dateTimeIST}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">Vyayama Physio — Automated Notification</p>
    </div>
  `;
}

export function missedSessionDoctorHtml(
  doctorName: string,
  patientName: string,
  dateTimeIST: string
): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#dc2626">Missed Session Alert ❌</h2>
      <p>Dear <strong>${doctorName}</strong>,</p>
      <p>The following appointment was marked as <strong>MISSED</strong>.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Patient</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${patientName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Scheduled Time (IST)</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${dateTimeIST}</td></tr>
      </table>
      <p style="margin-top:16px">Please follow up with the patient to reschedule.</p>
      <p style="color:#6b7280;font-size:12px">Vyayama Physio — Automated Notification</p>
    </div>
  `;
}