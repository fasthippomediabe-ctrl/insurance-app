import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List salary profiles
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profiles = await db.salaryProfile.findMany({
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeNo: true, primaryPosition: true, branchId: true, branch: { select: { name: true } }, isActive: true },
      },
    },
    orderBy: { employee: { lastName: "asc" } },
  });

  return NextResponse.json(profiles);
}

// POST: Create or update salary profile
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { employeeId, ...fields } = data;

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }

  const profile = await db.salaryProfile.upsert({
    where: { employeeId },
    create: { employeeId, ...fields },
    update: fields,
  });

  return NextResponse.json(profile);
}
