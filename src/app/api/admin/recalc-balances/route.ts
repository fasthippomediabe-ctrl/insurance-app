import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BC_RATES, TA_RATES, isCommissionable } from "@/lib/utils";
import { PlanCategory } from "@prisma/client";

// POST: Recalculate all collector balances AND fix stored remittance totals
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Reset all AO balances to 0
  await db.employee.updateMany({
    where: { primaryPosition: "AO" },
    data: { collectorBalance: 0 },
  });

  // Get all remittances with their payments
  const remittances = await db.remittance.findMany({
    include: {
      payments: {
        include: { member: { select: { planCategory: true } } },
        orderBy: { installmentNo: "asc" },
      },
    },
    orderBy: { remittanceDate: "asc" },
  });

  // Track prior paid counts per member (for TA: first payment = no TA)
  const memberPaidCount = new Map<string, number>();
  const collectorBalances = new Map<string, number>();

  for (const rem of remittances) {
    let totalCollection = 0;
    let totalBc = 0;
    let totalTa = 0;
    let totalOthers = 0;

    for (const p of rem.payments) {
      const plan = p.member.planCategory as PlanCategory;
      const comm = isCommissionable(p.installmentNo);
      const amount = Number(p.amount);
      const others = Number(p.othersDeduction ?? 0);

      let bc = 0;
      let ta = 0;

      if (comm && !p.isFree) {
        bc = BC_RATES[plan];
        const priorPaid = memberPaidCount.get(p.memberId) ?? 0;
        if (priorPaid > 0) {
          ta = TA_RATES[plan];
        }
      }

      // Track paid count (non-free only)
      if (!p.isFree) {
        memberPaidCount.set(p.memberId, (memberPaidCount.get(p.memberId) ?? 0) + 1);
      }

      totalCollection += amount;
      totalBc += bc;
      totalTa += ta;
      totalOthers += others;
    }

    const correctNet = totalCollection - totalBc - totalTa - totalOthers;

    // Update stored totals on the remittance
    await db.remittance.update({
      where: { id: rem.id },
      data: {
        totalCollection,
        totalCommission: totalBc,
        travellingAllowance: totalTa,
        totalOthers,
        netRemittance: correctNet,
      },
    });

    // Compute variance for collector balance
    const deposit = Number(rem.totalDeposit ?? correctNet);
    const variance = deposit - correctNet;
    if (variance !== 0) {
      collectorBalances.set(
        rem.collectorId,
        (collectorBalances.get(rem.collectorId) ?? 0) + variance
      );
    }
  }

  // Apply corrected balances
  for (const [collectorId, balance] of collectorBalances) {
    await db.employee.update({
      where: { id: collectorId },
      data: { collectorBalance: balance },
    });
  }

  return NextResponse.json({
    ok: true,
    remittancesFixed: remittances.length,
    collectorsUpdated: collectorBalances.size,
  });
}
