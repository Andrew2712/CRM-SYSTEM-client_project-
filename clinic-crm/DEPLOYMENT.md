# Deployment runbook

This document covers everything needed to deploy, maintain, and roll back the Clinic CRM. Read it end-to-end before your first deploy.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | bundled with Node |
| Vercel CLI | latest | `npm i -g vercel` |
| Git | any | https://git-scm.com |

External accounts required before starting:

- **Neon** — PostgreSQL database (https://neon.tech)
- **Upstash** — Redis for rate limiting and session revocation (https://upstash.com)
- **Resend** — transactional email (https://resend.com)
- **Meta for Developers** — WhatsApp Cloud API (https://developers.facebook.com)
- **Sentry** — error tracking (https://sentry.io)
- **Vercel** — hosting (https://vercel.com)

---

## First deploy (step by step)

### 1. Clone and install

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo/clinic-crm
npm ci
```

### 2. Set up environment variables

Copy the example file and fill in every value:

```bash
cp .env.example .env.local
```

Open `.env.local` and set all variables. The comments in `.env.example` explain what each one is and where to get it. Every variable marked `[REQUIRED]` must be filled before the app will start.

To generate secrets locally:

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -hex 32
```

### 3. Set up the Neon database

1. Create a new project at https://console.neon.tech
2. Copy the connection string (includes `?sslmode=require`) into `DATABASE_URL`
3. Run migrations to create all tables:

```bash
npx prisma migrate deploy
```

4. (Optional but recommended) Seed the database with demo staff accounts:

```bash
npm run seed
```

Seed creates these accounts (change passwords immediately in production):

| Role | Email | Password |
|---|---|---|
| Admin | admin@clinic.com | admin123 |
| Doctor | dr.priya@clinic.com | doctor123 |
| Doctor | dr.arun@clinic.com | doctor123 |
| Receptionist | reception@clinic.com | reception123 |

### 4. Verify locally

```bash
npm run dev
```

Open http://localhost:3000 and confirm you can log in with the seeded admin account. Check the browser console and terminal for errors.

### 5. Deploy to Vercel

```bash
# Link the project to Vercel (first time only)
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

Or connect the GitHub repo to Vercel for automatic deploys on push to `main`.

### 6. Set environment variables in Vercel

In the Vercel dashboard → your project → Settings → Environment Variables, add every variable from `.env.example` that is marked `[REQUIRED]` or `[REQUIRED in production]`.

Set each variable for the **Production** environment. Variables for Preview and Development environments can differ.

After adding variables, trigger a new deployment for them to take effect.

### 7. Wire up the reminder cron job

The hourly reminder (24h and 2h appointment reminders) runs via GitHub Actions, not Vercel cron. Set two repository secrets:

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add `CRON_SECRET` — must match the `CRON_SECRET` set in Vercel
3. Add `APP_URL` — your production URL, e.g. `https://your-app.vercel.app`

The `auto-miss` and `waitlist-expire` cron jobs are configured in `vercel.json` and run automatically on Vercel's infrastructure with no extra setup.

### 8. Verify production

After deploy:

- [ ] Open `https://your-app.vercel.app` and log in
- [ ] Check `https://your-app.vercel.app/api/health` returns `{"status":"ok","db":"ok"}`
- [ ] Create a test appointment and confirm the booking confirmation email arrives
- [ ] Check Sentry dashboard for any boot-time errors

---

## Routine deployments

Every push to `main` (or merge of a PR) that passes CI will be deployed automatically if the GitHub repo is connected to Vercel.

The build command in `vercel.json` runs migrations before building:

```
npx prisma migrate deploy && npx prisma generate && next build
```

This means migrations are applied automatically on every deploy. **Always review migration SQL before merging** — see the migrations section below.

---

## Database migrations

### Creating a migration

```bash
# Make schema changes in prisma/schema.prisma, then:
npx prisma migrate dev --name describe_your_change
```

This creates a new file in `prisma/migrations/`. Commit both the schema and the migration file.

### Reviewing a migration before production

Always read the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` before merging. Look for:

- `DROP TABLE` or `DROP COLUMN` — irreversible data loss
- Large `ALTER TABLE` on tables with millions of rows — can lock the table
- Missing indexes on new foreign keys

### Applying migrations manually (emergency)

If auto-migration fails during a deploy:

```bash
# Connect to production DB using DATABASE_URL
export DATABASE_URL="your-production-connection-string"
npx prisma migrate deploy
```

### Reverting a migration

Prisma does not support automatic rollbacks. To revert:

1. Write a new migration that undoes the change (e.g. if you added a column, add a migration that drops it)
2. Deploy the revert migration

For destructive changes that cannot be undone, restore from a Neon backup (see below).

---

## Rollback procedure

### Application rollback (Vercel)

1. Go to Vercel dashboard → your project → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → **Promote to Production**

This instantly re-promotes the old deployment. No rebuild required.

### Database rollback (Neon point-in-time restore)

Neon supports branch-based point-in-time restore:

1. Go to https://console.neon.tech → your project → Branches
2. Click **Create branch** → set the restore point to before the bad migration
3. Update `DATABASE_URL` in Vercel to point to the restored branch
4. Redeploy the rolled-back application version

After verifying the restore is correct, promote the branch back to main and update `DATABASE_URL`.

---

## CI secrets setup

The CI pipeline (`.github/workflows/ci.yml`) needs these repository secrets to run tests:

| Secret | Description |
|---|---|
| `DATABASE_URL` | A dedicated CI/test database (not production) |
| `NEXTAUTH_SECRET` | Any random 32-char string |
| `RESEND_API_KEY` | Resend test key (`re_test_...`) |
| `EMAIL_FROM` | Any valid email address |
| `META_WA_TOKEN` | Meta Cloud API token |
| `META_WA_PHONE_ID` | Meta phone number ID |
| `CRON_SECRET` | Any random string |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `E2E_ADMIN_EMAIL` | (optional) Admin email for Playwright tests |
| `E2E_ADMIN_PASSWORD` | (optional) Admin password for Playwright tests |

Use a separate Neon branch or separate Neon project for `DATABASE_URL` in CI so tests never touch production data.

---

## Monitoring

### Health check

The `/api/health` endpoint returns database connectivity status. Wire it to an uptime monitor:

- **UptimeRobot** (free): https://uptimerobot.com — add HTTP monitor pointing to `https://your-app.vercel.app/api/health`
- Set alert threshold to 2 consecutive failures before alerting

### Error tracking

Sentry is configured in `src/instrumentation.ts` (server) and `src/instrumentation-client.ts` (client). Set up alert rules in Sentry for:

- New issues (email immediately)
- Issue frequency spike (> 10 occurrences in 1 hour)

### Logs

Vercel captures stdout/stderr but only retains logs for 1 hour on the free plan. For persistent logs, connect a log drain:

1. Vercel dashboard → your project → Settings → Log Drains
2. Connect Axiom (https://axiom.co, free tier available) or Logtail
3. All `logger.info/warn/error` calls emit structured JSON that will be searchable in the drain

---

## Resetting a staff member's password

Use the admin dashboard → Staff → reset password button. This does not require database access.

For the admin account itself (if locked out):

```bash
export DATABASE_URL="your-production-connection-string"

# Generate a new bcrypt hash for the new password
node -e "const b=require('bcryptjs'); b.hash('NewPassword123!', 10).then(h => console.log(h))"

# Update the hash directly
npx prisma studio
# Or via psql:
# UPDATE "User" SET "passwordHash" = '<hash>' WHERE email = 'admin@clinic.com';
```

---

## Common issues

**Build fails with "Missing required environment variables"**
One or more variables in `envValidation.ts` are not set in Vercel. Check the build logs for the exact variable names and add them in Vercel → Settings → Environment Variables.

**`prisma migrate deploy` fails during build**
The `DATABASE_URL` does not have the correct permissions or the connection string is wrong. Verify the string in Neon's dashboard and confirm it includes `?sslmode=require`.

**WhatsApp messages not sending**
Check that `META_WA_TEMPLATE_BOOKING`, `META_WA_TEMPLATE_REMINDER`, and `META_WA_TEMPLATE_MISSED` match exactly the template names approved in Meta Business Manager. Template names are case-sensitive.

**Cron reminder job not running**
Verify the GitHub Actions secrets `CRON_SECRET` and `APP_URL` are set in the repo. Check the Actions tab for recent workflow runs and their logs.

**Session not revoking immediately after staff deactivation**
Redis may be unreachable. Check Upstash dashboard for connectivity. The auth system falls back to allowing sessions through if Redis is down — this is intentional to prevent an outage from locking all staff out.