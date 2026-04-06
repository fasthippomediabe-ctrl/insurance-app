const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const m = await db.member.findUnique({
    where: { mafNo: "3155" },
    select: { id: true, mafNo: true, firstName: true, lastName: true, mopCode: true, monthlyDue: true, totalPlanAmount: true },
  });
  console.log("Member:", JSON.stringify(m, null, 2));

  const payments = await db.payment.findMany({
    where: { memberId: m.id },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
    select: { installmentNo: true, periodMonth: true, periodYear: true, amount: true, isFree: true },
  });

  console.log("\nPayments:", payments.length);
  for (const p of payments) {
    console.log(`  #${p.installmentNo}  ${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}  Amt: ${Number(p.amount)}  ${p.isFree ? "FREE" : ""}`);
  }

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  console.log("\nTotal paid (DB amounts):", total);
}

main().catch(console.error).finally(() => db.$disconnect());
