import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function allowed(role: string) {
  return role === "ADMIN" || role === "ACCOUNTING";
}

// GET: list liabilities
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const liabilities = await db.liability.findMany({
    where: { ...(status ? { status } : {}) },
    include: { payments: { orderBy: { payDate: "desc" } } },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(liabilities);
}

// POST: create liability (for existing loans we're importing)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const {
    lenderName, lenderContact, branchId, principal, interestRate, totalPayable,
    currentBalance, frequency, paymentAmount, startDate, maturityDate, termMonths,
    purpose, notes,
  } = data;

  if (!lenderName || !principal || !startDate) {
    return NextResponse.json({ error: "lenderName, principal, startDate required" }, { status: 400 });
  }

  const count = await db.liability.count();
  const liabilityNo = `LIA-${String(count + 1).padStart(5, "0")}`;

  const payable = totalPayable ? Number(totalPayable) : Number(principal) * (1 + Number(interestRate || 0) / 100);
  const balance = currentBalance !== undefined ? Number(currentBalance) : payable;

  const liability = await db.liability.create({
    data: {
      liabilityNo,
      lenderName,
      lenderContact: lenderContact || null,
      branchId: branchId || null,
      principal,
      interestRate: interestRate || 0,
      totalPayable: payable,
      currentBalance: balance,
      frequency: frequency || "MONTHLY",
      paymentAmount: paymentAmount || 0,
      startDate: new Date(startDate),
      maturityDate: maturityDate ? new Date(maturityDate) : null,
      termMonths: termMonths || null,
      purpose: purpose || null,
      notes: notes || null,
      recordedBy: user.id,
    },
  });

  return NextResponse.json(liability, { status: 201 });
}

// PATCH: record a payment OR update liability fields
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { id, action } = data;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const liability = await db.liability.findUnique({ where: { id } });
  if (!liability) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "PAY") {
    const { amount, principalPaid, interestPaid, penaltyPaid, payDate, paymentMethod, referenceNo, notes } = data;
    if (!amount) return NextResponse.json({ error: "amount required" }, { status: 400 });

    const princ = principalPaid !== undefined ? Number(principalPaid) : Number(amount);
    const intr = Number(interestPaid || 0);
    const pen = Number(penaltyPaid || 0);

    await db.liabilityPayment.create({
      data: {
        liabilityId: id,
        amount,
        principalPaid: princ,
        interestPaid: intr,
        penaltyPaid: pen,
        payDate: payDate ? new Date(payDate) : new Date(),
        paymentMethod: paymentMethod || null,
        referenceNo: referenceNo || null,
        notes: notes || null,
        recordedBy: user.id,
      },
    });

    const newBalance = Math.max(0, Number(liability.currentBalance) - princ);
    const status = newBalance <= 0 ? "FULLY_PAID" : "ACTIVE";

    const updated = await db.liability.update({
      where: { id },
      data: { currentBalance: newBalance, status },
    });

    return NextResponse.json(updated);
  }

  // Plain field update
  const { lenderName, lenderContact, principal, interestRate, totalPayable, currentBalance, frequency, paymentAmount, startDate, maturityDate, termMonths, purpose, notes, status } = data;
  const updateData: any = {};
  if (lenderName !== undefined) updateData.lenderName = lenderName;
  if (lenderContact !== undefined) updateData.lenderContact = lenderContact || null;
  if (principal !== undefined) updateData.principal = principal;
  if (interestRate !== undefined) updateData.interestRate = interestRate;
  if (totalPayable !== undefined) updateData.totalPayable = totalPayable;
  if (currentBalance !== undefined) updateData.currentBalance = currentBalance;
  if (frequency !== undefined) updateData.frequency = frequency;
  if (paymentAmount !== undefined) updateData.paymentAmount = paymentAmount;
  if (startDate !== undefined) updateData.startDate = new Date(startDate);
  if (maturityDate !== undefined) updateData.maturityDate = maturityDate ? new Date(maturityDate) : null;
  if (termMonths !== undefined) updateData.termMonths = termMonths;
  if (purpose !== undefined) updateData.purpose = purpose;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;

  const updated = await db.liability.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}

// DELETE
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.liability.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
