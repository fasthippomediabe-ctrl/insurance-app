import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List loans
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || undefined;
  const status = searchParams.get("status") || undefined;

  const loans = await db.loan.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNo: true, primaryPosition: true },
      },
      payments: { orderBy: { payDate: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(loans);
}

// POST: Create loan
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { employeeId, type, description, amount, monthlyDeduction, startDate } = data;

  if (!employeeId || !amount) {
    return NextResponse.json({ error: "employeeId and amount required" }, { status: 400 });
  }

  const loan = await db.loan.create({
    data: {
      employeeId,
      type: type || "CASH_ADVANCE",
      description: description || null,
      amount,
      balance: amount,
      monthlyDeduction: monthlyDeduction || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
    },
  });

  return NextResponse.json(loan);
}
