/**
 * src/app/api/patients/route.ts
 * GET  /api/patients — list (cursor-paginated)
 * POST /api/patients — create
 *
 * Pagination query params:
 *   cursor   — the `id` of the last item from the previous page (optional)
 *   limit    — items per page, 1–100, defaults to 50
 *
 * Response shape:
 *   { data: Patient[], nextCursor: string | null, hasMore: boolean }
 *
 * Client usage:
 *   Page 1:  GET /api/patients?limit=50
 *   Page 2:  GET /api/patients?limit=50&cursor=<lastId>
 *   Stop when hasMore === false.
 *
 * NOTE: We inline the Prisma query here (using activityInclude + enrichWithActivity
 * from @/lib/patientActivity) instead of delegating to fetchPatientsWithActivity,
 * because fetchPatientsWithActivity returns a plain array and does not expose the
 * orderBy / take / cursor knobs that cursor pagination requires.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PatientStatus } from "@prisma/client";
import { requireAuth, getPatientFilter } from "@/lib/rbac";
import { activityInclude, enrichWithActivity } from "@/lib/patientActivity";
import bcrypt from "bcryptjs";
import { rateLimitRead, rateLimitWrite, rateLimitResponse } from "@/lib/rateLimit";
import { auditPatient } from "@/lib/audit";
import { CreatePatientSchema, validate } from "@/lib/validation";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

async function generatePatientCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PHY-${year}-`;
  const last = await prisma.patient.findFirst({
    where: { patientCode: { startsWith: prefix } },
    orderBy: { patientCode: "desc" },
    select: { patientCode: true },
  });
  const nextNumber = last ? parseInt(last.patientCode.replace(prefix, ""), 10) + 1 : 1;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const rl = await rateLimitRead(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  try {
    const params       = req.nextUrl.searchParams;
    const searchTerm   = params.get("search") ?? "";
    const statusFilter = params.get("status") ?? "";
    const cursor       = params.get("cursor") ?? undefined;
    const rawLimit     = parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const limit        = Math.min(Math.max(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, 1), MAX_LIMIT);

    const rbacScope = getPatientFilter(session);

    const rows = await prisma.patient.findMany({
      where: {
        isActive: true,
        ...rbacScope,
        ...(searchTerm ? {
          OR: [
            { name:        { contains: searchTerm, mode: "insensitive" } },
            { phone:       { contains: searchTerm } },
            { patientCode: { contains: searchTerm, mode: "insensitive" } },
          ],
        } : {}),
        ...(statusFilter ? { status: statusFilter as PatientStatus } : {}),
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        ...activityInclude,
        _count: { select: { appointments: true } },
      },
    });

    const hasMore    = rows.length > limit;
    const pageRows   = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;
    const data       = enrichWithActivity(pageRows);

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    console.error("GET /patients error:", error);
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitWrite(req);
  if (!rl.success) return rateLimitResponse(rl);

  let session;
  try { session = await requireAuth(); } catch (err) { return err as NextResponse; }

  if (session.user.role === "DOCTOR")
    return NextResponse.json({ error: "Doctors are not permitted to create patient records" }, { status: 403 });

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // ── Zod validation ────────────────────────────────────────────────────────
  // Guard on !validated.data instead of validated.error so TypeScript
  // can narrow `body` to the non-undefined type in the happy path.
  const validated = validate(CreatePatientSchema, rawBody);
  if (!validated.data) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const body = validated.data; // ← fully typed, never undefined from here on

  try {
    const existing = await prisma.patient.findUnique({ where: { phone: body.phone } });
    if (existing)
      return NextResponse.json({ error: "Patient with this phone already exists", existing }, { status: 409 });

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const patientCode      = await generatePatientCode();
        const registrationDate = new Date().toISOString().slice(0, 10);
        const firstName        = body.name.trim().split(/\s+/)[0];
        const rawPassword      = `${firstName}_${registrationDate}`;
        const passwordHash     = await bcrypt.hash(rawPassword, 10);

        const patient = await prisma.patient.create({
          data: {
            patientCode,
            name:                 body.name,
            phone:                body.phone,
            email:                body.email || null,
            age:                  body.age ?? null,
            gender:               body.gender ?? null,
            address:              body.address ?? null,
            purposeOfVisit:       body.purposeOfVisit ?? null,
            medicalConditions:    body.medicalConditions ?? null,
            status:               body.status ?? PatientStatus.NEW,
            phase:                body.phase ?? null,
            totalSessionsPlanned: body.totalSessionsPlanned ?? 0,
            passwordHash:         body.email ? passwordHash : null,
          },
        });

        await auditPatient(session, req, "CREATE", patient.id, {
          name: patient.name,
          new:  { patientCode, name: patient.name, phone: patient.phone, email: patient.email },
        });

        return NextResponse.json(
          { ...patient, _credentials: body.email ? { username: body.email, defaultPassword: rawPassword } : null },
          { status: 201 }
        );
      } catch (err: unknown) {
        const prismaErr = err as { code?: string };
        if (prismaErr.code === "P2002" && attempt < 4) continue;
        console.error("Create patient error:", err);
        return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Failed to generate a unique patient code" }, { status: 500 });
  } catch (error) {
    console.error("POST /patients error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}