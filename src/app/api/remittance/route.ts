import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BC_RATES, TA_RATES, isCommissionable } from "@/lib/utils";
import { PlanCategory } from "@prisma/client";
import { z } from "zod";

const RowSchema = z.object({
  orNo: z.string().min(1),
  orDate: z.string(),
  memberId: z.string(),
  startInstallmentNo: z.number().int().min(1),
  monthsCount: z.number().int().min(1).default(1),
  isFree: z.boolean().default(false),
  bcOutright: z.boolean().default(true),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2020),
  amount: z.number().min(0),
  others: z.number().min(0).default(0),
});

const RemittanceSchema = z.object({
  remittanceNo: z.string().min(1),
  collectorId: z.string(),
  branchId: z.string(),
  remittanceDate: z.string(),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2020),
  receivedBy: z.string().optional(),
  collectionSupervisor: z.string().optional(),
  branchManagerName: z.string().optional(),
  totalDeposit: z.number().min(0).optional(),
  notes: z.string().optional(),
  rows: z.array(RowSchema).min(1),
});

function validateOrSequential(orNos: string[]): { valid: boolean; missing: number[] } {
  const nums = orNos
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));

  if (nums.length === 0) return { valid: true, missing: [] };

  const unique = new Set(nums);
  if (unique.size !== nums.length) return { valid: false, missing: [] }; // duplicates

  const sorted = [...unique].sort((a, b) => a - b);
  const missing: number[] = [];
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
    if (!unique.has(i)) missing.push(i);
  }
  return { valid: missing.length === 0, missing };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const where: any = {};
  if (user.role === "BRANCH_STAFF") where.branchId = user.branchId;

  const remittances = await db.remittance.findMany({
    where,
    include: {
      collector: { select: { firstName: true, lastName: true, employeeNo: true } },
      branch: { select: { name: true } },
      payments: { select: { id: true, amount: true, installmentNo: true } },
    },
    orderBy: { remittanceDate: "desc" },
  });

  return NextResponse.json(remittances);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RemittanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Validate OR sequential
  const orValidation = validateOrSequential(data.rows.map((r) => r.orNo));
  if (!orValidation.valid) {
    const msg = orValidation.missing.length
      ? `OR numbers are not sequential. Missing: ${orValidation.missing.join(", ")}`
      : "Duplicate OR numbers detected.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // Check remittance number is unique
  const existing = await db.remittance.findUnique({ where: { remittanceNo: data.remittanceNo } });
  if (existing) {
    return NextResponse.json({ error: `Remittance number ${data.remittanceNo} already exists.` }, { status: 409 });
  }

  // Check collector exists and is AO
  const collector = await db.employee.findUnique({
    where: { id: data.collectorId },
    select: { id: true, primaryPosition: true },
  });
  if (!collector) return NextResponse.json({ error: "Collector not found." }, { status: 404 });

  // Load all members to get plan categories
  const memberIds = [...new Set(data.rows.map((r) => r.memberId))];
  const members = await db.member.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, planCategory: true, monthlyDue: true },
  });
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Get prior paid payment counts per member (for TA: first payment has no TA)
  const priorPaidCounts = await db.payment.groupBy({
    by: ["memberId"],
    where: { memberId: { in: memberIds }, isFree: false },
    _count: true,
  });
  const priorPaidMap = new Map(priorPaidCounts.map((c) => [c.memberId, c._count]));
  // Track paid installments per member within this remittance
  const memberPaidIdx = new Map<string, number>();

  // Compute per-row BC, TA, Others
  let totalCollection = 0;
  let totalBc = 0;
  let totalTa = 0;
  let totalOthers = 0;

  const rowsWithComputed = data.rows.map((row) => {
    const member = memberMap.get(row.memberId);
    const plan = member?.planCategory as PlanCategory | undefined;
    const months = row.monthsCount ?? 1;
    const others = row.others ?? 0;

    let bc = 0;
    let ta = 0;

    if (!row.isFree) {
      const priorPaid = priorPaidMap.get(row.memberId) ?? 0;
      const paidBefore = memberPaidIdx.get(row.memberId) ?? 0;

      for (let i = 0; i < months; i++) {
        const inst = row.startInstallmentNo + i;
        if (plan && isCommissionable(inst)) {
          bc += BC_RATES[plan];
          // TA: skip first-ever paid installment
          if (priorPaid + paidBefore + i > 0) {
            ta += TA_RATES[plan];
          }
        }
      }
      memberPaidIdx.set(row.memberId, paidBefore + months);
    }

    totalCollection += row.amount;
    totalBc += bc;
    totalTa += ta;
    totalOthers += others;

    return { ...row, bc, ta, others };
  });

  const netRemittance = totalCollection - totalBc - totalTa - totalOthers;

  // Duplicate OR number check against existing payments
  const existingOrNos = await db.payment.findMany({
    where: { orNo: { in: data.rows.map((r) => r.orNo) } },
    select: { orNo: true },
  });
  if (existingOrNos.length > 0) {
    return NextResponse.json(
      { error: `OR numbers already used: ${existingOrNos.map((p) => p.orNo).join(", ")}` },
      { status: 409 }
    );
  }

  const remittance = await db.$transaction(async (tx) => {
    // Create remittance first
    const rem = await tx.remittance.create({
      data: {
        remittanceNo: data.remittanceNo,
        collectorId: data.collectorId,
        branchId: data.branchId,
        remittanceDate: new Date(data.remittanceDate),
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        totalCollection,
        totalCommission: totalBc,
        travellingAllowance: totalTa,
        totalOthers,
        netRemittance,
        totalDeposit: data.totalDeposit ?? null,
        receivedBy: data.receivedBy ?? null,
        collectionSupervisor: data.collectionSupervisor ?? null,
        branchManagerName: data.branchManagerName ?? null,
        notes: data.notes,
      },
    });

    // Expand rows into individual payment records
    const paymentRecords: any[] = [];
    for (const row of rowsWithComputed) {
      const months = row.monthsCount ?? 1;
      const member = memberMap.get(row.memberId);
      const amountPerMonth = member ? Number(member.monthlyDue) : (months > 0 ? row.amount / months : 0);
      const othersPerMonth = row.others > 0 ? row.others / months : 0;

      // If FREE: create installment #1 as FREE (₱0) first
      if (row.isFree) {
        const freeInstNo = row.startInstallmentNo - 1; // #1 (paid starts at #2)
        let fpm = row.periodMonth - 1;
        let fpy = row.periodYear;
        if (fpm < 1) { fpm = 12; fpy--; }

        paymentRecords.push({
          memberId: row.memberId,
          collectorId: data.collectorId,
          remittanceId: rem.id,
          orNo: row.orNo,
          orDate: new Date(row.orDate),
          installmentNo: freeInstNo,
          periodMonth: fpm,
          periodYear: fpy,
          paymentDate: new Date(data.remittanceDate),
          amount: 0,
          isFree: true,
          bcOutright: false,
          paymentMethod: "CASH" as const,
        });
      }

      // Create paid installment records
      for (let i = 0; i < months; i++) {
        let pm = row.periodMonth + i;
        let py = row.periodYear;
        while (pm > 12) { pm -= 12; py++; }

        paymentRecords.push({
          memberId: row.memberId,
          collectorId: data.collectorId,
          remittanceId: rem.id,
          orNo: row.orNo,
          orDate: new Date(row.orDate),
          installmentNo: row.startInstallmentNo + i,
          periodMonth: pm,
          periodYear: py,
          paymentDate: new Date(data.remittanceDate),
          amount: amountPerMonth,
          isFree: false,
          bcOutright: row.bcOutright ?? true,
          othersDeduction: othersPerMonth > 0 ? othersPerMonth : null,
          paymentMethod: "CASH" as const,
        });
      }
    }

    await tx.payment.createMany({ data: paymentRecords });

    // Update collector balance: variance = deposit - net
    // Negative = deficit (owes), Positive = surplus
    const actualDeposit = data.totalDeposit ?? netRemittance;
    const variance = actualDeposit - netRemittance;
    if (variance !== 0) {
      await tx.employee.update({
        where: { id: data.collectorId },
        data: { collectorBalance: { increment: variance } },
      });
    }

    return rem;
  });

  return NextResponse.json(remittance, { status: 201 });
}
