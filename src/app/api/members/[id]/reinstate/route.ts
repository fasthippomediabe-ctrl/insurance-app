import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, newAgentId, reinstatementFee } = await req.json();

  if (!type || !newAgentId) {
    return NextResponse.json({ error: "Missing type or newAgentId" }, { status: 400 });
  }

  const member = await db.member.findUnique({
    where: { id: params.id },
    include: {
      payments: {
        orderBy: { installmentNo: "desc" },
        select: { installmentNo: true, periodMonth: true, periodYear: true, isFree: true },
      },
    },
  });

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthlyDue = Number(member.monthlyDue);
  const lastInstallment = member.payments.length > 0
    ? Math.max(...member.payments.map(p => p.installmentNo))
    : 0;

  // Calculate unpaid months
  const paidSet = new Set(
    member.payments.filter(p => !p.isFree).map(p => `${p.periodYear}-${p.periodMonth}`)
  );
  const startDate = member.reinstatedDate ?? member.effectivityDate ?? member.enrollmentDate;
  const unpaidMonths: { month: number; year: number }[] = [];
  const cursor = new Date(startDate);
  cursor.setDate(1);
  while (cursor <= now) {
    const m = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    if (!paidSet.has(`${y}-${m}`)) {
      unpaidMonths.push({ month: m, year: y });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  await db.$transaction(async (tx) => {
    let nextInst = lastInstallment + 1;

    if (type === "UPDATE") {
      // Pay all missed months
      for (const um of unpaidMonths) {
        await tx.payment.create({
          data: {
            memberId: member.id,
            installmentNo: nextInst,
            periodMonth: um.month,
            periodYear: um.year,
            paymentDate: now,
            amount: monthlyDue,
            isFree: false,
            notes: "Reinstatement (Updating) - back payment",
          },
        });
        nextInst++;
      }
    } else {
      // REDATE: Pay 2 months from current month
      for (let i = 0; i < 2; i++) {
        let pm = currentMonth + i;
        let py = currentYear;
        if (pm > 12) { pm -= 12; py++; }

        await tx.payment.create({
          data: {
            memberId: member.id,
            installmentNo: nextInst + i,
            periodMonth: pm,
            periodYear: py,
            paymentDate: now,
            amount: monthlyDue,
            isFree: false,
            notes: "Reinstatement (Redating) - advance payment",
          },
        });
      }
    }

    // Record reinstatement fee as a separate payment with 0 installment
    await tx.payment.create({
      data: {
        memberId: member.id,
        installmentNo: 0,
        periodMonth: currentMonth,
        periodYear: currentYear,
        paymentDate: now,
        amount: reinstatementFee ?? 100,
        isFree: false,
        notes: "Reinstatement fee",
      },
    });

    // Update member: status, agent, reinstatement date/type
    await tx.member.update({
      where: { id: member.id },
      data: {
        status: "REINSTATED",
        agentId: newAgentId,
        reinstatedDate: now,
        reinstateType: type,
        // For REDATE, update effectivity to current month
        ...(type === "REDATE" ? {
          effectivityDate: new Date(currentYear, currentMonth - 1, 1),
        } : {}),
        // Set operation month/year to current for NE counting
        operationMonth: currentMonth,
        operationYear: currentYear,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
