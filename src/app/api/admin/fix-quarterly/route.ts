import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MONTHLY_RATES: Record<string, number> = {
  FIME: 420, FIQE: 420, FISAE: 420, FIAE: 420,
  FIME2: 450, FIQE2: 450, FISAE2: 450, FIAE2: 450,
  NIMC: 340, NIQC: 340, NISAC: 340, NIAC: 340,
  NIMC2: 380, NIQC2: 380, NISAC2: 380, NIAC2: 380,
  FIMC: 650, FIQC: 650, FISAC: 650, FIAC: 650,
  IIMR: 1250, IIQR: 1250, IISAR: 1250, IIAR: 1250,
};

function getMultiplier(mopCode: string): number {
  const code = mopCode.toUpperCase();
  if (code.includes("IQE") || code.includes("IQC") || code.includes("IQR") || code === "NIQC" || code === "NIQC2" || code === "IIQR") return 3;
  if (code.includes("SAE") || code.includes("SAC") || code.includes("SAR") || code === "NISAC" || code === "NISAC2" || code === "IISAR") return 6;
  if (code.includes("IAE") || code.includes("IAC") || code.includes("IAR") || code === "NIAC" || code === "NIAC2" || code === "IIAR") return 12;
  return 1;
}

// POST: Revert — restore payments that were wrongly changed from monthly rate to discounted rate
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const monthlyMops = ["FIME", "FIME2", "NIMC", "NIMC2", "FIMC", "IIMR", "SPOT_CASH"];

  const members = await db.member.findMany({
    where: { mopCode: { notIn: monthlyMops as any } },
    select: { id: true, mafNo: true, firstName: true, lastName: true, mopCode: true, monthlyDue: true },
  });

  let totalFixed = 0;
  let totalMembers = 0;
  const details: string[] = [];

  for (const m of members) {
    const multiplier = getMultiplier(m.mopCode);
    if (multiplier <= 1) continue;

    const monthlyBase = Number(m.monthlyDue);
    const wrongDiscountedRate = Math.round(monthlyBase * 0.9 * 100) / 100;

    // Find payments that were wrongly changed to the discounted rate
    const payments = await db.payment.findMany({
      where: {
        memberId: m.id,
        isFree: false,
        amount: wrongDiscountedRate,
      },
      select: { id: true },
    });

    if (payments.length === 0) continue;

    totalMembers++;

    // Restore to original monthly rate
    await db.payment.updateMany({
      where: { id: { in: payments.map((p) => p.id) } },
      data: { amount: monthlyBase },
    });

    totalFixed += payments.length;
    details.push(`MAF ${m.mafNo} (${m.firstName} ${m.lastName}) — ${payments.length} payments: ₱${wrongDiscountedRate} → ₱${monthlyBase} (reverted)`);
  }

  return NextResponse.json({
    totalMembers,
    totalFixed,
    details,
    message: `Reverted ${totalFixed} payments across ${totalMembers} members back to original amounts.`,
  });
}
