/**
 * src/lib/waitlistNotifications.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Notification helpers for the Waitlist system.
 * Sends WhatsApp + Email to the patient when a slot becomes available.
 */

import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { createInAppNotification, notifyAdminAndReceptionist } from "@/lib/inAppNotifications";

// ─── Types ────────────────────────────────────────────────────────────────────

type WaitlistEntry = {
  id:           string;
  preferredTime?: string | null;
  patient: {
    id:    string;
    name:  string;
    phone: string;
    email: string | null;
  };
  doctor: {
    id:   string;
    name: string;
  };
};

// ─── Dev overrides ────────────────────────────────────────────────────────────

// ✅ AFTER (production always uses real contact):
function resolveEmail(real: string | null | undefined): string | null {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && process.env.DEV_TEST_EMAIL?.trim()) {
    return process.env.DEV_TEST_EMAIL.trim();
  }
  return real?.trim() || null;
}

function resolvePhone(real: string | null | undefined): string | null {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && process.env.DEV_TEST_PHONE?.trim()) {
    return process.env.DEV_TEST_PHONE.trim();
  }
  return real?.trim() || null;
}

// ─── Main notification sender ─────────────────────────────────────────────────

export async function sendWaitlistSlotNotification(
  entry:   WaitlistEntry,
  dateStr: string   // "YYYY-MM-DD" IST — for display
): Promise<void> {
  const { patient, doctor } = entry;
  const displayDate = formatDate(dateStr);
  const displayTime = entry.preferredTime ?? "your preferred time";

  const patientPhone = resolvePhone(patient.phone);
  const patientEmail = resolveEmail(patient.email);

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  if (patientPhone) {
    const msg =
      `Hello ${patient.name} 👋\n\n` +
      `🎉 *Good news — a slot is now available!*\n\n` +
      `Dr. ${doctor.name} has an opening on:\n` +
      `📅 Date: ${displayDate}\n` +
      `🕐 Time: ${displayTime}\n\n` +
      `Please call us or reply to confirm your booking.\n` +
      `⚠️ This slot is reserved for *2 hours* — first-come, first-served.\n\n` +
      `— Vyayama Physio`;

    try {
      await sendWhatsApp(patientPhone, msg);
    } catch (err) {
      console.error("[Waitlist] WhatsApp failed for", entry.id, err);
    }
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  if (patientEmail) {
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
        <div style="background:#5B1A0E;border-radius:16px;padding:24px;margin-bottom:24px">
          <h1 style="color:#F4A261;margin:0;font-size:20px">🎉 A Slot is Available!</h1>
        </div>
        <p>Dear <strong>${patient.name}</strong>,</p>
        <p>Great news! A slot has opened up with <strong>Dr. ${doctor.name}</strong>.</p>
        <div style="background:#FFF7ED;border:2px solid #F4A261;border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0"><strong>📅 Date:</strong> ${displayDate}</p>
          <p style="margin:8px 0 0"><strong>🕐 Time:</strong> ${displayTime}</p>
          <p style="margin:8px 0 0"><strong>👨‍⚕️ Doctor:</strong> Dr. ${doctor.name}</p>
        </div>
        <p>Please call us to confirm your booking. This slot will be held for <strong>2 hours</strong>.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">
          Vyayama Physio — Automated Waitlist Notification
        </p>
      </div>
    `;

    try {
      await sendEmail(patientEmail, "🎉 A Slot is Now Available — Vyayama Physio", html);
    } catch (err) {
      console.error("[Waitlist] Email failed for", entry.id, err);
    }
  }

  // ── In-app notification ────────────────────────────────────────────────────
  await createInAppNotification(
    doctor.id,
    "WAITLIST_SLOT_AVAILABLE" as any,
    "Waitlist Patient Notified",
    `${patient.name} has been notified of an available slot on ${displayDate}.`,
    entry.id
  ).catch(console.error);

  await notifyAdminAndReceptionist(
    "WAITLIST_SLOT_AVAILABLE" as any,
    "Waitlist: Slot Available",
    `${patient.name} notified for Dr. ${doctor.name}'s slot on ${displayDate}.`,
    entry.id
  ).catch(console.error);
}

// ─── Booking confirmation ─────────────────────────────────────────────────────

export async function sendWaitlistBookingConfirmed(
  entry:         WaitlistEntry,
  appointmentId: string,
  dateStr:       string
): Promise<void> {
  const { patient, doctor } = entry;
  const displayDate = formatDate(dateStr);

  const patientPhone = resolvePhone(patient.phone);
  if (patientPhone) {
    const msg =
      `Hello ${patient.name} 👋\n\n` +
      `✅ *Your waitlist booking is confirmed!*\n\n` +
      ` ${doctor.name}\n📅 ${displayDate}\n\n` +
      `We'll see you then!\n\n— Vyayama Physio`;
    try { await sendWhatsApp(patientPhone, msg); } catch { /* best-effort */ }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
