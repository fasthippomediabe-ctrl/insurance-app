import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "") || undefined;
  const year = parseInt(searchParams.get("year") ?? "") || undefined;
  const branchId = searchParams.get("branchId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;

  const where: any = { status: "POSTED" };
  if (month && year) {
    where.expenseDate = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }
  if (branchId) where.branchId = branchId;
  if (categoryId) where.categoryId = categoryId;

  const expenses = await db.expense.findMany({
    where,
    include: { category: true },
    orderBy: { expenseDate: "desc" },
    take: 200,
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { categoryId, branchId, amount, expenseDate, description, vendor, paymentMethod, receiptNo, receiptPhoto, notes } = data;

  if (!categoryId || !amount || !expenseDate || !description) {
    return NextResponse.json({ error: "categoryId, amount, expenseDate, description required" }, { status: 400 });
  }

  const count = await db.expense.count();
  const expenseNo = `EXP-${String(count + 1).padStart(6, "0")}`;

  const expense = await db.expense.create({
    data: {
      expenseNo,
      categoryId,
      branchId: branchId || null,
      amount,
      expenseDate: new Date(expenseDate),
      description,
      vendor: vendor || null,
      paymentMethod: paymentMethod || null,
      receiptNo: receiptNo || null,
      receiptPhoto: receiptPhoto || null,
      notes: notes || null,
      recordedBy: user.id,
    },
  });
  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.expense.update({ where: { id }, data: { status: "VOID" } });
  return NextResponse.json({ ok: true });
}
