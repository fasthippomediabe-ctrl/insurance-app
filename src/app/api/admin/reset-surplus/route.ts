import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST: Reset all collector surplus balances to 0 at end of month operation
// Deficits (negative) are NOT reset — they carry forward
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await db.employee.updateMany({
    where: {
      primaryPosition: "AO",
      collectorBalance: { gt: 0 },
    },
    data: { collectorBalance: 0 },
  });

  return NextResponse.json({
    ok: true,
    resetCount: result.count,
    message: `${result.count} collector surplus balance(s) reset to ₱0.`,
  });
}
