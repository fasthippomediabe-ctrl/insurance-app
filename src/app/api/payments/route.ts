import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeInstallmentNo, isCommissionable } from "@/lib/utils";
import { z } from "zod";

const PaymentSchema = z.object({
  memberId: z.string(),
  collectorId: z.string().optional(),
  startPeriodMonth: z.number().int().min(1).max(12),
  startPeriodYear: z.number().int().min(2000),
  months: z.number().int().min(1).max(12).default(1),
  startInstallmentNo: z.number().int().min(1).optional(),
  paymentDate: z.string(),
  amountPerMonth: z.number().min(0),
  isFree: z.boolean().default(false),
  isSpotCash: z.boolean().default(false),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "GCASH", "OTHER"]).default("CASH"),
  notes: z.string().optional(),
});

// Build consecutive periods from a starting month/year
function buildPeriods(startMonth: number, startYear: number, count: number) {
  const result = [];
  let m = startMonth;
  let y = startYear;
  for (let i = 0; i < count; i++) {
    result.push({ month: m, year: y });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const collectorId = searchParams.get("collectorId");

  const where: any = {};
  if (memberId) where.memberId = memberId;
  if (collectorId) where.collectorId = collectorId;
  if (user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR") where.member = { branchId: user.branchId };

  const payments = await db.payment.findMany({
    where,
    include: { member: true, collector: true },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = PaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const member = await db.member.findUnique({
    where: { id: data.memberId },
    select: { effectivityDate: true, enrollmentDate: true, agentId: true, status: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const effectivityDate = member.effectivityDate ?? member.enrollmentDate;
  const periods = buildPeriods(data.startPeriodMonth, data.startPeriodYear, data.months);

  // FREE is only valid for installment #1
  const firstInstallment = data.startInstallmentNo
    ?? computeInstallmentNo(data.startPeriodYear, data.startPeriodMonth, new Date(effectivityDate));
  if (data.isFree && firstInstallment !== 1) {
    return NextResponse.json({ error: "Free 1st month is only applicable for new members (installment #1)." }, { status: 422 });
  }

  // Check all periods are not already paid
  const conflicts = await db.payment.findMany({
    where: {
      memberId: data.memberId,
      OR: periods.map((p) => ({ periodYear: p.year, periodMonth: p.month })),
    },
    select: { periodYear: true, periodMonth: true },
  });

  if (conflicts.length > 0) {
    const labels = conflicts
      .map((c) => `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][c.periodMonth - 1]} ${c.periodYear}`)
      .join(", ");
    return NextResponse.json(
      { error: `Payment already recorded for: ${labels}` },
      { status: 409 }
    );
  }

  const paymentDate = new Date(data.paymentDate);

  const payments = await db.$transaction(async (tx) => {
    const created = [];

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const installmentNo = data.startInstallmentNo
        ? data.startInstallmentNo + i
        : computeInstallmentNo(period.year, period.month, new Date(effectivityDate));

      // First period is FREE (₱0) when isFree=true; the rest are regular paid
      const isThisFree = data.isFree && i === 0;
      const recordAmount = isThisFree ? 0 : data.amountPerMonth;

      const payment = await tx.payment.create({
        data: {
          memberId: data.memberId,
          collectorId: data.collectorId || null,
          periodMonth: period.month,
          periodYear: period.year,
          paymentDate,
          amount: recordAmount,
          installmentNo,
          isFree: isThisFree,
          isSpotCash: data.isSpotCash,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });
      created.push(payment);

      // Auto-create commission record for agent (installments 1–12, not free)
      if (member.agentId && isCommissionable(installmentNo) && !isThisFree) {
        await tx.commission.create({
          data: {
            employeeId: member.agentId,
            memberId: data.memberId,
            installmentNo,
            paymentDate,
            grossAmount: data.amountPerMonth,
            commissionRate: 0,
            commissionAmt: 0,
          },
        });
      }
    }

    // Update member status if LAPSED
    if (member.status === "LAPSED") {
      await tx.member.update({
        where: { id: data.memberId },
        data: { status: "ACTIVE" },
      });
    }

    return created;
  });

  return NextResponse.json(payments, { status: 201 });
}
