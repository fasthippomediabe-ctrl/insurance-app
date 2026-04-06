import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List cutoffs for a branch
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();

  const cutoffs = await db.operationCutoff.findMany({
    where: { ...(branchId ? { branchId } : {}), year },
    orderBy: { month: "asc" },
  });

  return NextResponse.json(cutoffs);
}

// POST: Create or update a cutoff extension
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { branchId, month, year, extendedDate, reason } = body;

  if (!branchId || !month || !year || !extendedDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Default cutoff = last day of the month
  const defaultDate = new Date(year, month, 0); // day 0 of next month = last day of this month

  const cutoff = await db.operationCutoff.upsert({
    where: { branchId_month_year: { branchId, month, year } },
    create: {
      branchId,
      month,
      year,
      defaultDate,
      extendedDate: new Date(extendedDate),
      reason: reason || null,
    },
    update: {
      extendedDate: new Date(extendedDate),
      reason: reason || null,
    },
  });

  return NextResponse.json(cutoff);
}

// DELETE: Remove a cutoff extension (revert to default)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.operationCutoff.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
