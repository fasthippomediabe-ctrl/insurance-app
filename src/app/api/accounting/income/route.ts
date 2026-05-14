import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "") || undefined;
  const year = parseInt(searchParams.get("year") ?? "") || undefined;
  const branchId = searchParams.get("branchId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;

  const where: any = { status: "POSTED" };
  if (month && year) {
    where.incomeDate = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }
  if (branchId) where.branchId = branchId;
  if (categoryId) where.categoryId = categoryId;

  const incomes = await db.income.findMany({
    where,
    include: { category: true },
    orderBy: { incomeDate: "desc" },
    take: 200,
  });
  return NextResponse.json(incomes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await req.json();
    const { categoryId, branchId, amount, incomeDate, description, payer, paymentMethod, receiptNo, receiptPhoto, notes } = data;

    if (!categoryId || amount === undefined || amount === null || amount === "" || !incomeDate || !description) {
      return NextResponse.json({ error: "categoryId, amount, incomeDate, description required" }, { status: 400 });
    }
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const last = await db.income.findFirst({
      orderBy: { incomeNo: "desc" },
      select: { incomeNo: true },
    });
    const lastNum = last ? parseInt(last.incomeNo.replace(/^INC-/, ""), 10) : 0;
    let nextNum = (isFinite(lastNum) ? lastNum : 0) + 1;

    let income;
    for (let attempt = 0; attempt < 5; attempt++) {
      const incomeNo = `INC-${String(nextNum).padStart(6, "0")}`;
      try {
        income = await db.income.create({
          data: {
            incomeNo,
            categoryId,
            branchId: branchId || null,
            amount: amt,
            incomeDate: new Date(incomeDate),
            description,
            payer: payer || null,
            paymentMethod: paymentMethod || null,
            receiptNo: receiptNo || null,
            receiptPhoto: receiptPhoto || null,
            notes: notes || null,
            recordedBy: user.id,
          },
        });
        break;
      } catch (e: any) {
        if (e?.code === "P2002") { nextNum++; continue; }
        throw e;
      }
    }
    if (!income) return NextResponse.json({ error: "Could not generate income number" }, { status: 500 });
    return NextResponse.json(income, { status: 201 });
  } catch (e: any) {
    console.error("[income POST]", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await req.json();
    const { id, categoryId, branchId, amount, incomeDate, description, payer, paymentMethod, receiptNo, receiptPhoto, notes } = data;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updateData: any = {};
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (branchId !== undefined) updateData.branchId = branchId || null;
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!isFinite(amt) || amt <= 0) return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      updateData.amount = amt;
    }
    if (incomeDate !== undefined) updateData.incomeDate = new Date(incomeDate);
    if (description !== undefined) updateData.description = description;
    if (payer !== undefined) updateData.payer = payer || null;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;
    if (receiptNo !== undefined) updateData.receiptNo = receiptNo || null;
    if (receiptPhoto !== undefined) updateData.receiptPhoto = receiptPhoto || null;
    if (notes !== undefined) updateData.notes = notes || null;

    const income = await db.income.update({ where: { id }, data: updateData });
    return NextResponse.json(income);
  } catch (e: any) {
    console.error("[income PATCH]", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.income.update({ where: { id }, data: { status: "VOID" } });
  return NextResponse.json({ ok: true });
}
