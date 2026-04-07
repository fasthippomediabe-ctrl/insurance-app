import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_CATEGORIES = [
  // Operating
  { name: "Rent", type: "OPERATING", description: "Office and branch rent" },
  { name: "Utilities", type: "OPERATING", description: "Electricity, water, internet" },
  { name: "Office Supplies", type: "OPERATING", description: "Paper, ink, pens, etc." },
  { name: "Transportation", type: "OPERATING", description: "Fuel, fare, vehicle maintenance" },
  { name: "Communication", type: "OPERATING", description: "Phone, mobile load" },
  { name: "Repairs & Maintenance", type: "OPERATING", description: "Office equipment repairs" },
  { name: "Marketing & Advertising", type: "OPERATING", description: "Tarpaulins, flyers, ads" },
  { name: "Professional Fees", type: "OPERATING", description: "Legal, accounting, consultancy" },
  // Administrative
  { name: "Permits & Licenses", type: "ADMINISTRATIVE", description: "Business permits, BIR, SEC" },
  { name: "Bank Charges", type: "ADMINISTRATIVE", description: "Bank fees, online transfer fees" },
  { name: "Meetings & Trainings", type: "ADMINISTRATIVE", description: "Trainings, seminars, meetings" },
  // Other
  { name: "Other Expense", type: "OTHER", description: "Miscellaneous expenses" },
];

// POST: Seed default expense categories
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let created = 0;
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await db.expenseCategory.findUnique({ where: { name: cat.name } });
    if (!existing) {
      await db.expenseCategory.create({ data: cat as any });
      created++;
    }
  }

  return NextResponse.json({ created, message: `Created ${created} expense categories.` });
}
