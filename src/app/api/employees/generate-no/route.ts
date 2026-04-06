import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Format: KID-MO-001
// Branch prefix (first 3 letters of branch name) + Position + sequence number

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const position = searchParams.get("position");
  const branchId = searchParams.get("branchId");

  if (!position || !branchId) {
    return NextResponse.json({ error: "Missing position or branchId" }, { status: 400 });
  }

  const branch = await db.branch.findUnique({ where: { id: branchId } });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  // Get 3-letter branch prefix from branch name
  // e.g. "Kidapawan Branch" → "KID"
  const branchPrefix = branch.name
    .replace(/branch/i, "")
    .trim()
    .substring(0, 3)
    .toUpperCase();

  // Count existing employees with same primary position in same branch
  const count = await db.employee.count({
    where: { primaryPosition: position as any, branchId },
  });

  const sequence = String(count + 1).padStart(3, "0");
  const employeeNo = `${branchPrefix}-${position}-${sequence}`;

  return NextResponse.json({ employeeNo });
}
