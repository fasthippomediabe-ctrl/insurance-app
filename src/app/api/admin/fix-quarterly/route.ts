import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function getMultiplier(mopCode: string): number {
  const code = mopCode.toUpperCase();
  if (code.includes("IQE") || code.includes("IQC") || code.includes("IQR") || code === "NIQC" || code === "NIQC2" || code === "IIQR") return 3;
  if (code.includes("SAE") || code.includes("SAC") || code.includes("SAR") || code === "NISAC" || code === "NISAC2" || code === "IISAR") return 6;
  if (code.includes("IAE") || code.includes("IAC") || code.includes("IAR") || code === "NIAC" || code === "NIAC2" || code === "IIAR") return 12;
  return 1;
}

// POST: Fix only GROUPED payments (multiple payments on same date) to use discounted rate
// Single monthly payments (1 payment per date) are left untouched
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
    const discountedRate = Math.round(monthlyBase * 0.9 * 100) / 100;

    // Get all non-free payments at the full monthly rate
    const payments = await db.payment.findMany({
      where: { memberId: m.id, isFree: false, amount: monthlyBase },
      select: { id: true, paymentDate: true },
      orderBy: { paymentDate: "asc" },
    });

    if (payments.length === 0) continue;

    // Group by payment date — only fix payments that have multiple on the same date
    const byDate = new Map<string, string[]>();
    for (const p of payments) {
      const dateKey = p.paymentDate.toISOString().split("T")[0];
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(p.id);
    }

    const idsToFix: string[] = [];
    for (const [, ids] of byDate) {
      if (ids.length >= multiplier) {
        // This is a grouped payment (e.g., 3 payments on same date for quarterly)
        idsToFix.push(...ids);
      }
    }

    if (idsToFix.length === 0) continue;

    totalMembers++;

    await db.payment.updateMany({
      where: { id: { in: idsToFix } },
      data: { amount: discountedRate },
    });

    totalFixed += idsToFix.length;
    const groupCount = idsToFix.length / multiplier;
    details.push(`MAF ${m.mafNo} (${m.firstName} ${m.lastName}) — ${idsToFix.length} payments in ${groupCount} groups: ₱${monthlyBase} → ₱${discountedRate} (${multiplier}×₱${discountedRate} = ₱${discountedRate * multiplier})`);
  }

  return NextResponse.json({
    totalMembers,
    totalFixed,
    details,
    message: `Fixed ${totalFixed} grouped payments across ${totalMembers} members. Single monthly payments were NOT changed.`,
  });
}
