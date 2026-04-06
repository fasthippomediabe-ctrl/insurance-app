import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST: Update payments for a specific month from CSV data
// Body: { rows: [{mafNo, amount, collectorName}...], month, year, branchId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { entries, month, year, branchId } = await req.json() as {
    entries: { mafNo: string; amount: number; collectorName?: string }[];
    month: number;
    year: number;
    branchId: string;
  };

  if (!entries || !month || !year || !branchId) {
    return NextResponse.json({ error: "Missing entries, month, year, or branchId" }, { status: 400 });
  }

  const results = { created: 0, skipped: 0, updated: 0, errors: [] as string[] };

  for (const entry of entries) {
    try {
      const mafNo = entry.mafNo.trim();
      if (!mafNo || mafNo === "0") { results.skipped++; continue; }

      const member = await db.member.findUnique({
        where: { mafNo },
        select: { id: true, monthlyDue: true, planCategory: true, status: true },
      });

      if (!member) {
        results.errors.push(`MAF ${mafNo}: member not found`);
        continue;
      }

      const amount = entry.amount;
      if (!amount || amount <= 0) { results.skipped++; continue; }

      // Check if payment already exists for this member in this month/year
      const existing = await db.payment.findFirst({
        where: {
          memberId: member.id,
          periodMonth: month,
          periodYear: year,
          isFree: false,
        },
      });

      if (existing) {
        // Already has a payment for this month — skip
        results.skipped++;
        continue;
      }

      // Get the current max installment number for this member
      const maxInst = await db.payment.aggregate({
        where: { memberId: member.id },
        _max: { installmentNo: true },
      });
      let nextInst = (maxInst._max.installmentNo ?? 0) + 1;

      // Calculate how many installments this payment covers
      const monthlyDue = Number(member.monthlyDue);
      let installmentCount = 1;
      if (monthlyDue > 0 && amount > monthlyDue * 0.9) {
        installmentCount = Math.round(amount / monthlyDue);
        if (installmentCount < 1) installmentCount = 1;
      }

      // Resolve collector if provided
      let collectorId: string | null = null;
      if (entry.collectorName) {
        const name = entry.collectorName.trim();
        if (name) {
          const parts = name.split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts[parts.length - 1] || "";
          const collector = await db.employee.findFirst({
            where: {
              branchId,
              firstName: { contains: firstName, mode: "insensitive" },
              lastName: { contains: lastName, mode: "insensitive" },
              primaryPosition: "AO",
            },
            select: { id: true },
          });
          if (collector) collectorId = collector.id;
        }
      }

      // Create payment record(s)
      for (let i = 0; i < installmentCount; i++) {
        await db.payment.create({
          data: {
            memberId: member.id,
            installmentNo: nextInst + i,
            periodMonth: month,
            periodYear: year,
            paymentDate: new Date(year, month - 1, 15),
            amount: monthlyDue > 0 ? monthlyDue : amount / installmentCount,
            isFree: false,
            ...(collectorId ? { collectorId } : {}),
          },
        });
        results.created++;
      }

      // Update member status if currently LAPSED but now paying
      if (member.status === "LAPSED") {
        await db.member.update({
          where: { id: member.id },
          data: { status: "ACTIVE" },
        });
      }

    } catch (err: any) {
      results.errors.push(`MAF ${entry.mafNo}: ${err.message?.slice(0, 200)}`);
    }
  }

  return NextResponse.json(results);
}
