import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function allowed(role: string) {
  return role === "ADMIN" || role === "ACCOUNTING";
}

// GET: list borrowings (filter by month/year or status)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "") || undefined;
  const year = parseInt(searchParams.get("year") ?? "") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (month && year) {
    where.borrowedDate = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }
  if (status) where.status = status;

  const borrowings = await db.borrowing.findMany({
    where,
    include: {
      source: true,
      repayments: { orderBy: { payDate: "desc" } },
    },
    orderBy: { borrowedDate: "desc" },
  });
  return NextResponse.json(borrowings);
}

// POST: create borrowing
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { sourceId, branchId, amount, interestRate, borrowedDate, dueDate, purpose, notes } = await req.json();
  if (!sourceId || !amount || !borrowedDate || !purpose) {
    return NextResponse.json({ error: "sourceId, amount, borrowedDate, purpose required" }, { status: 400 });
  }

  const count = await db.borrowing.count();
  const borrowingNo = `BOR-${String(count + 1).padStart(5, "0")}`;

  const borrowing = await db.borrowing.create({
    data: {
      borrowingNo,
      sourceId,
      branchId: branchId || null,
      amount,
      balance: amount,
      interestRate: interestRate || 0,
      borrowedDate: new Date(borrowedDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      purpose,
      notes: notes || null,
      recordedBy: user.id,
    },
  });

  return NextResponse.json(borrowing, { status: 201 });
}

// PATCH: record a repayment
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, amount, payDate, paymentMethod, notes } = await req.json();
  if (!id || !amount) return NextResponse.json({ error: "id and amount required" }, { status: 400 });

  const borrowing = await db.borrowing.findUnique({ where: { id } });
  if (!borrowing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.borrowingRepayment.create({
    data: {
      borrowingId: id,
      amount,
      payDate: payDate ? new Date(payDate) : new Date(),
      paymentMethod: paymentMethod || null,
      notes: notes || null,
      recordedBy: user.id,
    },
  });

  const newBalance = Math.max(0, Number(borrowing.balance) - Number(amount));
  const status = newBalance <= 0 ? "FULLY_PAID" : "ACTIVE";

  const updated = await db.borrowing.update({
    where: { id },
    data: { balance: newBalance, status },
  });

  return NextResponse.json(updated);
}

// DELETE: cancel/remove a borrowing
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.borrowing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
