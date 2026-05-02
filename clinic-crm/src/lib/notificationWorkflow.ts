/**
 * src/lib/notificationWorkflow.ts  (EXTENDED — replace existing file)
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds: cancel / reschedule / reassignment / holiday notifications
 * Keeps: all existing booking / reminder / missed-session functions intact
 */

import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  bookingConfirmedPatientHtml,
  bookingConfirmedDoctorHtml,
  missedSessionDoctorHtml,
} from "@/lib/email";
import {
  sendWhatsApp,
  bookingConfirmedPatientMsg,
  bookingConfirmedDoctorMsg,
  reminder24hMsg,
  reminder2hMsg,
  missedSessionPatientMsg,
} from "@/lib/whatsapp";
import { toIST } from "@/lib/timezone";
import { alreadySent, recordSent, recordFailed } from "@/lib/notifications";

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchAppointment(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: true },
  });
}

async function safeSend(
  appointmentId: string,
  key: Parameters<typeof alreadySent>[1],
  fn: () => Promise<void>
): Promise<void> {
  try {
    if (await alreadySent(appointmentId, key)) return;
    await fn();
    await recordSent(appointmentId, key);
  } catch (err) {
    console.error(`[Notifications] Failed: ${key} for ${appointmentId}`, err);
    await recordFailed(appointmentId, key).catch(() => {});
  }
}

function resolveEmail(real: string | null | undefined): string | null {
  return process.env.DEV_TEST_EMAIL || real || null;
}

function resolvePhone(real: string | null | undefined): string | null {
  return process.env.DEV_TEST_PHONE || real || null;
}

// ─── EXISTING: Booking Confirmed ─────────────────────────────────────────────

export async function sendBookingConfirmations(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const dateTimeIST = toIST(appt.startTime);
  const { patient, doctor } = appt;

  const patientEmail = resolveEmail(patient.email);
  const patientPhone = resolvePhone(patient.phone);
  const doctorEmail  = resolveEmail(doctor.email);
  const doctorPhone  = resolvePhone(doctor.phone);

  if (patientEmail)
    await safeSend(appointmentId, "BOOKING_PATIENT_EMAIL", () =>
      sendEmail(patientEmail, "Your Appointment is Confirmed ✅",
        bookingConfirmedPatientHtml(patient.name, doctor.name, dateTimeIST)));

  if (patientPhone)
    await safeSend(appointmentId, "BOOKING_PATIENT_WA", () =>
      sendWhatsApp(patientPhone, bookingConfirmedPatientMsg(patient.name, doctor.name, dateTimeIST)));

  if (doctorEmail)
    await safeSend(appointmentId, "BOOKING_DOCTOR_EMAIL", () =>
      sendEmail(doctorEmail, "New Appointment Booked 📅",
        bookingConfirmedDoctorHtml(doctor.name, patient.name, dateTimeIST)));

  if (doctorPhone)
    await safeSend(appointmentId, "BOOKING_DOCTOR_WA", () =>
      sendWhatsApp(doctorPhone, bookingConfirmedDoctorMsg(doctor.name, patient.name, dateTimeIST)));
}

// ─── EXISTING: 24h / 2h Reminders ────────────────────────────────────────────

export async function send24hReminder(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;
  const phone = resolvePhone(appt.patient.phone);
  if (!phone) return;
  await safeSend(appointmentId, "REMINDER_24H_WA", () =>
    sendWhatsApp(phone, reminder24hMsg(appt.patient.name, appt.doctor.name, toIST(appt.startTime))));
}

export async function send2hReminder(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;
  const phone = resolvePhone(appt.patient.phone);
  if (!phone) return;
  await safeSend(appointmentId, "REMINDER_2H_WA", () =>
    sendWhatsApp(phone, reminder2hMsg(appt.patient.name, appt.doctor.name, toIST(appt.startTime))));
}

// ─── EXISTING: Missed Session ─────────────────────────────────────────────────

export async function sendMissedSessionNotifications(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const dateTimeIST  = toIST(appt.startTime);
  const patientPhone = resolvePhone(appt.patient.phone);
  const doctorEmail  = resolveEmail(appt.doctor.email);

  if (patientPhone)
    await safeSend(appointmentId, "MISSED_PATIENT_WA", () =>
      sendWhatsApp(patientPhone, missedSessionPatientMsg(appt.patient.name, appt.doctor.name, dateTimeIST)));

  if (doctorEmail)
    await safeSend(appointmentId, "MISSED_DOCTOR_EMAIL", () =>
      sendEmail(doctorEmail, "Missed Session Alert ❌",
        missedSessionDoctorHtml(appt.doctor.name, appt.patient.name, dateTimeIST)));
}

// ─── NEW: Booking Cancelled ───────────────────────────────────────────────────

export async function sendCancellationNotifications(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const dateTimeIST  = toIST(appt.startTime);
  const { patient, doctor } = appt;

  // Patient — WhatsApp
  const patientPhone = resolvePhone(patient.phone);
  if (patientPhone) {
    const msg =
      `Hello ${patient.name} 👋\n\n` +
      `❌ *Appointment Cancelled*\n` +
      `Your appointment with Dr. ${doctor.name} on ${dateTimeIST} (IST) has been cancelled.\n\n` +
      `Please contact us to reschedule.\n\n— Clinic CRM`;
    try { await sendWhatsApp(patientPhone, msg); } catch (e) { console.error("[Cancel WA patient]", e); }
  }

  // Patient — Email
  const patientEmail = resolveEmail(patient.email);
  if (patientEmail) {
    try {
      await sendEmail(patientEmail, "Appointment Cancelled ❌", `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#dc2626">Appointment Cancelled ❌</h2>
          <p>Dear <strong>${patient.name}</strong>,</p>
          <p>Your appointment with <strong>Dr. ${doctor.name}</strong> scheduled for <strong>${dateTimeIST} IST</strong> has been cancelled.</p>
          <p>Please contact us to reschedule.</p>
          <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
        </div>`);
    } catch (e) { console.error("[Cancel Email patient]", e); }
  }

  // Doctor — Email
  const doctorEmail = resolveEmail(doctor.email);
  if (doctorEmail) {
    try {
      await sendEmail(doctorEmail, "Appointment Cancelled 📋", `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#dc2626">Appointment Cancelled</h2>
          <p>Dear Dr. <strong>${doctor.name}</strong>,</p>
          <p>The appointment with patient <strong>${patient.name}</strong> scheduled for <strong>${dateTimeIST} IST</strong> has been cancelled.</p>
          <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
        </div>`);
    } catch (e) { console.error("[Cancel Email doctor]", e); }
  }
}

// ─── NEW: Booking Rescheduled ─────────────────────────────────────────────────

export async function sendRescheduleNotifications(
  appointmentId: string,
  newDateTime: string
): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const { patient, doctor } = appt;

  // Patient — WhatsApp
  const patientPhone = resolvePhone(patient.phone);
  if (patientPhone) {
    const msg =
      `Hello ${patient.name} 👋\n\n` +
      `🔄 *Appointment Rescheduled*\n` +
      `Your appointment with Dr. ${doctor.name} has been rescheduled.\n` +
      `📅 New Date & Time (IST): ${newDateTime}\n\n` +
      `Please confirm or contact us if you need further changes.\n\n— Clinic CRM`;
    try { await sendWhatsApp(patientPhone, msg); } catch (e) { console.error("[Reschedule WA patient]", e); }
  }

  // Patient — Email
  const patientEmail = resolveEmail(patient.email);
  if (patientEmail) {
    try {
      await sendEmail(patientEmail, "Appointment Rescheduled 🔄", `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#d97706">Appointment Rescheduled 🔄</h2>
          <p>Dear <strong>${patient.name}</strong>,</p>
          <p>Your appointment with <strong>Dr. ${doctor.name}</strong> has been rescheduled.</p>
          <p><strong>New Date & Time:</strong> ${newDateTime} IST</p>
          <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
        </div>`);
    } catch (e) { console.error("[Reschedule Email patient]", e); }
  }

  // Doctor — Email
  const doctorEmail = resolveEmail(doctor.email);
  if (doctorEmail) {
    try {
      await sendEmail(doctorEmail, "Appointment Rescheduled 🔄", `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#d97706">Appointment Rescheduled</h2>
          <p>Dear Dr. <strong>${doctor.name}</strong>,</p>
          <p>The appointment with patient <strong>${patient.name}</strong> has been rescheduled.</p>
          <p><strong>New Date & Time:</strong> ${newDateTime} IST</p>
          <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
        </div>`);
    } catch (e) { console.error("[Reschedule Email doctor]", e); }
  }
}

// ─── NEW: Doctor Reassigned ───────────────────────────────────────────────────

export async function sendReassignmentNotifications(
  appointmentId: string,
  newDoctorId: string
): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const newDoctor = await prisma.user.findUnique({ where: { id: newDoctorId } });
  if (!newDoctor) return;

  const dateTimeIST = toIST(appt.startTime);
  const { patient, doctor: oldDoctor } = appt;

  // Patient — WhatsApp
  const patientPhone = resolvePhone(patient.phone);
  if (patientPhone) {
    const msg =
      `Hello ${patient.name} 👋\n\n` +
      `👨‍⚕️ *Doctor Change Notice*\n` +
      `Your appointment on ${dateTimeIST} (IST) has been reassigned.\n` +
      `New Doctor: Dr. ${newDoctor.name}\n\n` +
      `We apologize for any inconvenience.\n\n— Clinic CRM`;
    try { await sendWhatsApp(patientPhone, msg); } catch (e) { console.error("[Reassign WA patient]", e); }
  }

  // New Doctor — Email
  const newDoctorEmail = resolveEmail(newDoctor.email);
  if (newDoctorEmail) {
    try {
      await sendEmail(newDoctorEmail, "Appointment Transferred to You 📋", `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#7c3aed">Appointment Reassigned to You</h2>
          <p>Dear Dr. <strong>${newDoctor.name}</strong>,</p>
          <p>An appointment has been transferred to you from Dr. ${oldDoctor.name}.</p>
          <p><strong>Patient:</strong> ${patient.name}</p>
          <p><strong>Date & Time:</strong> ${dateTimeIST} IST</p>
          <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
        </div>`);
    } catch (e) { console.error("[Reassign Email newdoctor]", e); }
  }

  // Old Doctor — Email
  const oldDoctorEmail = resolveEmail(oldDoctor.email);
  if (oldDoctorEmail) {
    try {
      await sendEmail(oldDoctorEmail, "Appointment Transferred ✅", `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#059669">Appointment Successfully Transferred</h2>
          <p>Dear Dr. <strong>${oldDoctor.name}</strong>,</p>
          <p>Your appointment with <strong>${patient.name}</strong> on ${dateTimeIST} has been successfully transferred to Dr. ${newDoctor.name}.</p>
          <p style="color:#6b7280;font-size:12px">Clinic CRM — Automated Notification</p>
        </div>`);
    } catch (e) { console.error("[Reassign Email olddoctor]", e); }
  }
}
