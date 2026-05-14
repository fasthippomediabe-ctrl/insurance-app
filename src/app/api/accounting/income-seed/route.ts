import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_INCOME_CATEGORIES = [
  { name: "Starting Capital", type: "CAPITAL", description: "Initial capital contribution from owner(s)" },
  { name: "Additional Capital", type: "CAPITAL", description: "Additional capital contributions" },
  { name: "Processing Fee", type: "FEE", description: "MAF / enrollment processing fees" },
  { name: "Passbook Fee", type: "FEE", description: "Replacement passbook fees" },
  { name: "Transfer Fee", type: "FEE", description: "Plan transfer or assignment fees" },
  { name: "Insurance Premium", type: "PREMIUM", description: "Insurance premium income not tracked under member payments" },
  { name: "Interest Income", type: "INTEREST", description: "Interest from bank deposits, loans receivable" },
  { name: "Other Income", type: "OTHER", description: "Miscellaneous income" },
];

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let created = 0;
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    const existing = await db.incomeCategory.findUnique({ where: { name: cat.name } });
    if (!existing) {
      await db.incomeCategory.create({ data: cat as any });
      created++;
    }
  }

  return NextResponse.json({ created, message: `Created ${created} income categories.` });
}
