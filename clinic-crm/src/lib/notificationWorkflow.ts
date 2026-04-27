/**
 * src/lib/notificationWorkflow.ts
 */

import { prisma } from "@/lib/prisma";
import { sendEmail, bookingConfirmedPatientHtml, bookingConfirmedDoctorHtml, missedSessionDoctorHtml } from "@/lib/email";
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

async function fetchAppointment(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: true },
  });
}

/** Safely send and record — logs errors without throwing */
async function safeSend(
  appointmentId: string,
  key: Parameters<typeof alreadySent>[1],
  fn: () => Promise<void>
): Promise<void> {
  try {
    if (await alreadySent(appointmentId, key)) {
      console.log(`[Notifications] Already sent: ${key} for ${appointmentId}`);
      return;
    }
    await fn();
    await recordSent(appointmentId, key);
    console.log(`[Notifications] Sent: ${key} for ${appointmentId}`);
  } catch (err) {
    console.error(`[Notifications] Failed: ${key} for ${appointmentId}`, err);
    await recordFailed(appointmentId, key).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEV OVERRIDES
// During testing, Resend only allows sending to your own verified email.
// Twilio sandbox only allows opted-in numbers.
// Set these in .env.local to redirect ALL notifications to yourself:
//   DEV_TEST_EMAIL=andrewclinton2712@gmail.com
//   DEV_TEST_PHONE=+916363357287   ← must have joined Twilio sandbox
// In production, leave these empty and real patient/doctor contacts are used.
// ─────────────────────────────────────────────────────────────────────────────
function resolveEmail(real: string | null | undefined): string | null {
  return process.env.DEV_TEST_EMAIL || real || null;
}

function resolvePhone(real: string | null | undefined): string | null {
  return process.env.DEV_TEST_PHONE || real || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Booking Confirmed
// ─────────────────────────────────────────────────────────────────────────────

export async function sendBookingConfirmations(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) { console.error(`[Notifications] Appointment not found: ${appointmentId}`); return; }

  const dateTimeIST = toIST(appt.startTime);
  const { patient, doctor } = appt;

  const patientEmail = resolveEmail(patient.email);
  const patientPhone = resolvePhone(patient.phone);
  const doctorEmail  = resolveEmail(doctor.email);
  const doctorPhone  = resolvePhone(doctor.phone);

  // Patient — Email
  if (patientEmail) {
    await safeSend(appointmentId, "BOOKING_PATIENT_EMAIL", () =>
      sendEmail(patientEmail, "Your Appointment is Confirmed ✅",
        bookingConfirmedPatientHtml(patient.name, doctor.name, dateTimeIST))
    );
  }

  // Patient — WhatsApp
  if (patientPhone) {
    await safeSend(appointmentId, "BOOKING_PATIENT_WA", () =>
      sendWhatsApp(patientPhone, bookingConfirmedPatientMsg(patient.name, doctor.name, dateTimeIST))
    );
  }

  // Doctor — Email
  if (doctorEmail) {
    await safeSend(appointmentId, "BOOKING_DOCTOR_EMAIL", () =>
      sendEmail(doctorEmail, "New Appointment Booked 📅",
        bookingConfirmedDoctorHtml(doctor.name, patient.name, dateTimeIST))
    );
  }

  // Doctor — WhatsApp
  if (doctorPhone) {
    await safeSend(appointmentId, "BOOKING_DOCTOR_WA", () =>
      sendWhatsApp(doctorPhone, bookingConfirmedDoctorMsg(doctor.name, patient.name, dateTimeIST))
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: 24-Hour Reminder (Patient WhatsApp only)
// ─────────────────────────────────────────────────────────────────────────────

export async function send24hReminder(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const phone = resolvePhone(appt.patient.phone);
  if (!phone) return;

  await safeSend(appointmentId, "REMINDER_24H_WA", () =>
    sendWhatsApp(phone, reminder24hMsg(appt.patient.name, appt.doctor.name, toIST(appt.startTime)))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: 2-Hour Reminder (Patient WhatsApp only)
// ─────────────────────────────────────────────────────────────────────────────

export async function send2hReminder(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) return;

  const phone = resolvePhone(appt.patient.phone);
  if (!phone) return;

  await safeSend(appointmentId, "REMINDER_2H_WA", () =>
    sendWhatsApp(phone, reminder2hMsg(appt.patient.name, appt.doctor.name, toIST(appt.startTime)))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Missed Session (Patient WhatsApp + Doctor Email)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendMissedSessionNotifications(appointmentId: string): Promise<void> {
  const appt = await fetchAppointment(appointmentId);
  if (!appt) { console.error(`[Notifications] Appointment not found: ${appointmentId}`); return; }

  const dateTimeIST = toIST(appt.startTime);
  const { patient, doctor } = appt;

  const patientPhone = resolvePhone(patient.phone);
  const doctorEmail  = resolveEmail(doctor.email);

  if (patientPhone) {
    await safeSend(appointmentId, "MISSED_PATIENT_WA", () =>
      sendWhatsApp(patientPhone, missedSessionPatientMsg(patient.name, doctor.name, dateTimeIST))
    );
  }

  if (doctorEmail) {
    await safeSend(appointmentId, "MISSED_DOCTOR_EMAIL", () =>
      sendEmail(doctorEmail, "Missed Session Alert ❌",
        missedSessionDoctorHtml(doctor.name, patient.name, dateTimeIST))
    );
  }
}