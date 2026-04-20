import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const appointments = await prisma.appointment.findMany({
    where: { startTime: { gte: new Date(from), lt: new Date(to) } },
    orderBy: { startTime: "asc" },
    include: { patient: true, doctor: true },
  });

  return NextResponse.json(appointments);
}