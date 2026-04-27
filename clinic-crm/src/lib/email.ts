/**
 * src/lib/email.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Email utility using Resend (already in package.json)
 * Uses Resend instead of Nodemailer — already a project dependency.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email via Resend.
 *
 * @param to      Recipient email address
 * @param subject Email subject line
 * @param html    HTML body of the email
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "Clinic CRM <noreply@yourclinic.com>";

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Templates
// ─────────────────────────────────────────────────────────────────────────────

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
            <td style="padding:8px;border:1px solid #e5e7eb">Dr. ${doctorName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Date &amp; Time (IST)</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb">${dateTimeIST}</td></tr>
      </table>
      <p style="margin-top:16px">Please arrive 10 minutes early. If you need to reschedule, contact us at least 24 hours in advance.</p>
      <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
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
      <p style="color:#6b7280;font-size:12px;margin-top:16px">Clinic CRM — Automated Notification</p>
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
      <p style="margin-top:16px">Please follow up with the patient to reschedule if required.</p>
      <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
    </div>
  `;
}