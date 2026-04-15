import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function allowed(role: string) {
  return role === "ADMIN" || role === "HR" || role === "ACCOUNTING";
}

// GET: List attendance for a period
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");
  const half = parseInt(searchParams.get("half") ?? "");
  const employeeId = searchParams.get("employeeId") || undefined;

  if (!month || !year) return NextResponse.json({ error: "month and year required" }, { status: 400 });

  const lastDay = new Date(year, month, 0).getDate();
  let start: Date, end: Date;
  if (half === 1) { start = new Date(year, month - 1, 1); end = new Date(year, month - 1, 16); }
  else if (half === 2) { start = new Date(year, month - 1, 16); end = new Date(year, month - 1, lastDay + 1); }
  else { start = new Date(year, month - 1, 1); end = new Date(year, month, 1); }

  const records = await db.attendanceRecord.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNo: true, primaryPosition: true } },
    },
    orderBy: [{ date: "asc" }, { employee: { lastName: "asc" } }],
  });

  return NextResponse.json(records);
}

// POST: Create/update attendance
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { employeeId, date, timeIn, timeOut, hoursWorked, lateMinutes, isAbsent, isHalfDay, isHoliday, notes } = await req.json();
  if (!employeeId || !date) return NextResponse.json({ error: "employeeId and date required" }, { status: 400 });

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const existing = await db.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date: d } },
  });

  const data = {
    timeIn: timeIn || null,
    timeOut: timeOut || null,
    hoursWorked: hoursWorked ?? 0,
    lateMinutes: lateMinutes ?? 0,
    isAbsent: !!isAbsent,
    isHalfDay: !!isHalfDay,
    isHoliday: !!isHoliday,
    source: "MANUAL",
    notes: notes || null,
  };

  const record = existing
    ? await db.attendanceRecord.update({ where: { id: existing.id }, data })
    : await db.attendanceRecord.create({ data: { employeeId, date: d, ...data } });

  return NextResponse.json(record);
}

// DELETE
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.attendanceRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
