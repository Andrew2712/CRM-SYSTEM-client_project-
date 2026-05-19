# 🏥 Clinic CRM

> A full-stack, production-ready Customer Relationship Management system built specifically for medical clinics. Manage patients, appointments, staff, and multi-channel notifications — all from a single, role-aware dashboard.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [Role-Based Access Control](#-role-based-access-control)
- [Notification System](#-notification-system)
- [Automated Cron Jobs](#-automated-cron-jobs)
- [API Routes](#-api-routes)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)

---

## 🔍 Project Overview

Clinic CRM is a **Next.js 16** application designed to streamline the internal operations of a medical clinic. It provides separate portals for staff (Admins, Doctors, Receptionists) and patients, with a rich set of features including appointment scheduling, doctor reassignment, holiday request management, analytics dashboards, and automated WhatsApp + email notifications.

The system is built with a strong emphasis on **role-based access control (RBAC)**, ensuring that each user role only sees and interacts with data they are authorised to access.

---

## ✨ Features

### 👨‍💼 Admin Portal
- **Dashboard** — live stats for total patients, today's sessions, weekly no-show rate, and new vs returning patient split; interactive weekly bar chart with per-day drill-down
- **Analytics** — rich charts including monthly appointment trends, session type breakdown, gender distribution, phase/treatment distribution, and attendance rates (powered by Recharts)
- **Patient Management** — full patient registry with search, status filtering, and activity tracking (active/inactive based on last attended session)
- **Staff Management** — view and manage clinic staff profiles
- **Doctor Reassignment** — approve or reject requests to reassign patients between doctors
- **Holiday Requests** — review and action doctor leave requests
- **Notifications Centre** — in-app notification feed for all system events
- **User Sign-up & Password Reset** — create new staff accounts and reset credentials

### 👨‍⚕️ Doctor Portal
- **Personal Dashboard** — view own upcoming appointments, session queue, and patient list (scoped to assigned patients only)
- **Mark Sessions** — mark appointments as Attended, Missed, or Cancelled
- **Holiday Requests** — submit leave requests with date and reason
- **Doctor Reassignment Requests** — request transfer of a patient to another doctor

### 🧑‍💻 Receptionist Portal
- **Appointment Booking** — create appointments by selecting a patient, doctor, session type, date and time
- **Reschedule & Cancel** — reschedule or cancel existing appointments with modal confirmation
- **Patient Search** — quick lookup by name, phone, or patient code

### 🧑‍🤝‍🧑 Patient Portal
- **Patient Dashboard** — view upcoming and past appointments
- **Profile Management** — edit personal details via profile modal
- **Password Reset** — self-service password change

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Database** | PostgreSQL (via Neon serverless) |
| **ORM** | Prisma 7 |
| **Auth** | NextAuth.js v4 (JWT strategy, Credentials provider) |
| **Styling** | Tailwind CSS v4 |
| **UI Components** | Radix UI (Dialog, Select, Tabs) + Lucide React icons |
| **Charts** | Recharts |
| **Email** | Resend |
| **WhatsApp** | Twilio WhatsApp API |
| **Cron Jobs** | Vercel Cron |
| **Deployment** | Vercel |
| **Date Utilities** | date-fns |
| **Password Hashing** | bcryptjs |

---

## 🏛 Architecture

The application uses Next.js App Router with two distinct user-facing areas:

```
/auth/login              → Unified login for all roles
/dashboard/*             → Staff portal (Admin, Doctor, Receptionist)
/patient/*               → Patient portal
```

Middleware (`src/middleware.ts`) enforces route-level access:
- `/dashboard/*` redirects authenticated patients to `/patient/dashboard`
- `/patient/*` redirects authenticated staff to their role-specific dashboard
- Unauthenticated requests on protected routes are redirected to `/auth/login`

All API routes follow a consistent RBAC pattern using `requireAuth()` and `requireRole()` helpers from `src/lib/rbac.ts`.

---

## 🗄 Database Schema

The PostgreSQL database (managed via Prisma) contains the following models:

| Model | Description |
|---|---|
| `User` | Staff accounts (Admin, Doctor, Receptionist) |
| `Patient` | Patient records with medical metadata |
| `Appointment` | Scheduled sessions between a patient and a doctor |
| `PatientVisit` | Completed visit records linked to appointments |
| `AvailabilitySlot` | Doctor availability windows |
| `Notification` | Email/WhatsApp notification log with deduplication |
| `InAppNotification` | In-app notification feed per user |
| `AuditLog` | Full audit trail of all actions |
| `HolidayRequest` | Doctor leave requests (Pending/Approved/Rejected) |
| `DoctorReassignmentRequest` | Requests to transfer a patient to a different doctor |

### Key Enums

- **Role:** `ADMIN` | `DOCTOR` | `RECEPTIONIST` | `PATIENT`
- **AppointmentStatus:** `CONFIRMED` | `ATTENDED` | `MISSED` | `CANCELLED` | `RESCHEDULED`
- **SessionType:** `INITIAL_ASSESSMENT` | `FOLLOW_UP` | `SPECIALIZED`
- **NotificationChannel:** `EMAIL` | `WHATSAPP` | `CALENDAR`
- **Phase:** `PHASE_1` through `PHASE_5` (treatment phase tracking)

---

## 🔐 Role-Based Access Control

RBAC is enforced at both the **middleware** (route) level and the **API route** level.

### Role Capabilities

| Capability | Admin | Doctor | Receptionist |
|---|:---:|:---:|:---:|
| View all patients | ✅ | ❌ (own only) | ✅ |
| View all appointments | ✅ | ❌ (own only) | ✅ |
| Create appointments | ✅ | ✅ (self only) | ✅ |
| Cancel/Reschedule appointments | ✅ | ✅ (own only) | ✅ |
| Manage staff accounts | ✅ | ❌ | ❌ |
| View analytics | ✅ | ❌ | ❌ |
| Approve holiday requests | ✅ | ❌ | ❌ |
| Approve reassignments | ✅ | ❌ | ❌ |
| Submit holiday requests | ❌ | ✅ | ❌ |
| Request reassignment | ❌ | ✅ | ✅ |

### RBAC Helpers (`src/lib/rbac.ts`)

```ts
// Throws 401 if not authenticated
const session = await requireAuth();

// Throws 403 if role not in allowed list
requireRole(session, ["ADMIN"]);

// Returns a Prisma `where` filter scoped to the user's role
const filter = getAppointmentFilter(session);

// Throws 403 if a DOCTOR tries to access another doctor's appointment
await assertCanAccessAppointment(appointmentId, session);
```

---

## 📬 Notification System

The notification system is fully event-driven and sends messages via **email (Resend)** and **WhatsApp (Twilio)**. All notifications are deduplicated using sentinel timestamps stored in the `Notification` table.

### Notification Types

| Event | Patient (Email) | Patient (WhatsApp) | Doctor (Email) | Doctor (WhatsApp) |
|---|:---:|:---:|:---:|:---:|
| Appointment Booked | ✅ | ✅ | ✅ | ✅ |
| 24h Reminder | — | ✅ | — | — |
| 2h Reminder | — | ✅ | — | — |
| Appointment Missed | — | ✅ | ✅ | — |
| Appointment Cancelled | ✅ | ✅ | ✅ | — |
| Appointment Rescheduled | ✅ | ✅ | ✅ | — |
| Doctor Reassigned | — | ✅ | ✅ (new doctor) | — |

### Deduplication

Each notification type is assigned a unique sentinel `Date` as a dedup key. Before sending, the system checks if a `SENT` record already exists for that `(appointmentId, channel, sentinelDate)` combination. This prevents duplicate messages even if a cron job fires multiple times.

### Dev/Test Override

Set `DEV_TEST_EMAIL` and `DEV_TEST_PHONE` environment variables to redirect all outbound notifications to a test address/number during development.

---

## ⏰ Automated Cron Jobs

Two cron jobs are configured via `vercel.json`:

### 1. Reminder Job — `/api/cron/reminders`
**Schedule:** Every hour (`0 * * * *`)

Scans all `CONFIRMED` appointments within the next 26 hours and sends:
- **24h WhatsApp reminder** if the appointment is 23–24 hours away
- **2h WhatsApp reminder** if the appointment is 1–2 hours away

Uses time-range windows (not exact equality) to account for Vercel cron timing variance.

### 2. Auto-Miss Job — `/api/cron/auto-miss`
**Schedule:** Daily at 02:30 UTC (`30 2 * * *`)

Finds any `CONFIRMED` or `RESCHEDULED` appointments whose `endTime` is more than 36 hours in the past and automatically marks them as `MISSED`. Sends missed-session notifications and creates in-app alerts for the doctor and admin staff.

Both cron endpoints are secured with a `CRON_SECRET` bearer token header.

---

## 🔌 API Routes

### Authentication
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create a new staff account |
| `POST` | `/api/auth/reset-password` | Reset a staff password |
| `POST` | `/api/auth/[...nextauth]` | NextAuth.js handler |

### Appointments
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/appointments` | List appointments (RBAC-scoped) |
| `POST` | `/api/appointments` | Create an appointment |
| `GET/PATCH/DELETE` | `/api/appointments/[id]` | Read, update, or delete a specific appointment |
| `GET` | `/api/appointments/missed` | Fetch missed appointments |

### Patients
| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/patients` | List or create patients |
| `GET/PATCH/DELETE` | `/api/patients/[id]` | Read, update, or delete a patient |
| `GET` | `/api/patient/me` | Current patient's own profile |
| `POST` | `/api/patient/reset-password` | Patient self-service password reset |

### Staff & Doctors
| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/staff` | List staff or create account |
| `GET/PATCH/DELETE` | `/api/staff/[id]` | Manage a specific staff member |
| `GET` | `/api/doctors` | List all doctors |

### Admin
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Dashboard summary data |
| `GET` | `/api/admin/analytics` | Full analytics dataset |
| `GET` | `/api/admin/appointments` | Admin-level appointment list with date filtering |
| `GET/PATCH` | `/api/admin` | Admin-level operations |

### Workflow
| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/holiday-requests` | List or submit holiday requests |
| `PATCH` | `/api/holiday-requests/[id]` | Approve or reject a request |
| `GET/POST` | `/api/doctor-reassignment` | List or submit reassignment requests |
| `PATCH` | `/api/doctor-reassignment/[id]` | Accept or reject a reassignment |
| `GET` | `/api/notifications` | Fetch in-app notifications |

### Cron
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/cron/reminders` | Hourly reminder dispatch |
| `GET/POST` | `/api/cron/auto-miss` | Daily auto-miss sweep |

---

## 📁 Project Structure

```
clinic-crm/
├── prisma/
│   ├── schema.prisma          # Full database schema
│   ├── seed.ts                # Database seeder
│   └── update-doctors.ts      # Migration utility
│
├── src/
│   ├── app/
│   │   ├── api/               # All API route handlers
│   │   │   ├── admin/         # Admin-only endpoints
│   │   │   ├── appointments/  # Appointment CRUD + missed
│   │   │   ├── auth/          # Auth + signup + reset
│   │   │   ├── cron/          # Automated cron jobs
│   │   │   ├── doctor-reassignment/
│   │   │   ├── doctors/
│   │   │   ├── holiday-requests/
│   │   │   ├── notifications/
│   │   │   ├── patient/       # Patient self-service
│   │   │   └── staff/
│   │   │
│   │   ├── auth/login/        # Login page
│   │   │
│   │   ├── dashboard/         # Staff portal pages
│   │   │   ├── analytics/
│   │   │   ├── booking/
│   │   │   ├── doctor/
│   │   │   ├── holiday-requests/
│   │   │   ├── notifications/
│   │   │   ├── patients/
│   │   │   ├── reassignments/
│   │   │   ├── reset-password/
│   │   │   ├── signup/
│   │   │   └── staff/
│   │   │
│   │   └── patient/           # Patient portal pages
│   │       ├── dashboard/
│   │       ├── profile/
│   │       └── reset-password/
│   │
│   ├── components/
│   │   ├── ActivityBadge.tsx
│   │   ├── EditProfileModal.tsx
│   │   ├── HolidayRequestForm.tsx
│   │   ├── NotificationBell.tsx
│   │   ├── ReassignDoctorModal.tsx
│   │   ├── RescheduleModal.tsx
│   │   ├── SessionProvider.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SignOutButton.tsx
│   │   ├── staff/
│   │   │   ├── Analyticscharts.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   └── StatsCard.tsx
│   │   └── ui/
│   │       └── index.tsx
│   │
│   ├── lib/
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── email.ts               # Resend email client + HTML templates
│   │   ├── inAppNotifications.ts  # In-app notification helpers
│   │   ├── notificationWorkflow.ts # All notification dispatch logic
│   │   ├── notifications.ts       # Deduplication + recording
│   │   ├── patientActivity.ts     # Activity status computation
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── rbac.ts                # Role-based access helpers
│   │   ├── timezone.ts            # IST timezone utilities
│   │   ├── types.ts               # Shared TypeScript types
│   │   └── whatsapp.ts            # Twilio WhatsApp client + templates
│   │
│   └── middleware.ts              # Route protection middleware
│
├── public/
├── vercel.json                    # Cron job configuration
├── next.config.ts
├── prisma.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🔑 Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# ── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://..."         # Neon (or any PostgreSQL) connection string

# ── NextAuth ─────────────────────────────────────────────
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# ── Email (Resend) ────────────────────────────────────────
RESEND_API_KEY="re_..."
EMAIL_FROM="Clinic CRM <noreply@yourclinic.com>"

# ── WhatsApp (Twilio) ─────────────────────────────────────
TWILIO_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"

# ── Cron Security ─────────────────────────────────────────
CRON_SECRET="a-long-random-secret"

# ── Dev Overrides (optional) ──────────────────────────────
# Redirect all notifications to a test address in development
DEV_TEST_EMAIL="dev@yourdomain.com"
DEV_TEST_PHONE="+91XXXXXXXXXX"
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or [Neon](https://neon.tech))
- Resend account (for email)
- Twilio account with WhatsApp sandbox (for WhatsApp messages)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Andrew2712/CRM-SYSTEM-client_project-.git
cd CRM-SYSTEM-client_project--main/clinic-crm

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Push the database schema
npx prisma db push

# 5. (Optional) Seed the database with sample data
npm run seed

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Role Access After Seeding

After running the seed script, you should be able to log in with seeded staff and patient accounts. Refer to `prisma/seed.ts` for the default credentials.

---

## ☁️ Deployment

The application is configured for deployment on **Vercel**.

### Steps

1. Push your repository to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. Set all required environment variables in the Vercel project settings.
4. Deploy — Vercel will automatically detect the Next.js project.

### Cron Jobs

Vercel Cron Jobs are automatically configured via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

> **Note:** Add the auto-miss cron job manually in `vercel.json` if needed:
> ```json
> { "path": "/api/cron/auto-miss", "schedule": "30 2 * * *" }
> ```

Vercel automatically provides the `CRON_SECRET` header when invoking cron routes on Pro plans. Set `CRON_SECRET` in your environment variables to match.

### Build

```bash
npm run build   # Production build
npm start       # Start production server
npm run lint    # ESLint check
```

---

