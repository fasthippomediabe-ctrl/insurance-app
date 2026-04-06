import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Check if collector has unremitted collections for the branch
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const collectorId = searchParams.get("collectorId");
  const branchId = searchParams.get("branchId");

  if (!collectorId) {
    return NextResponse.json({ error: "collectorId required" }, { status: 400 });
  }

  // Check for payments collected by this collector that have no remittanceId
  // These are collections that haven't been remitted yet
  const unremitted = await db.payment.findMany({
    where: {
      collectorId,
      remittanceId: null,
      isFree: false,
      amount: { gt: 0 },
      // Only check payments from the last 60 days to avoid flagging old imported data
      paymentDate: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
    select: { paymentDate: true },
    orderBy: { paymentDate: "desc" },
  });

  if (unremitted.length === 0) {
    return NextResponse.json({ pending: 0 });
  }

  const lastDate = unremitted[0].paymentDate.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });

  return NextResponse.json({
    pending: unremitted.length,
    lastDate,
  });
}
