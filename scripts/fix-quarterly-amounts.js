const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// Monthly base rates per MOP
const MONTHLY_RATES = {
  FIME: 420, FIQE: 420, FISAE: 420, FIAE: 420,
  FIME2: 450, FIQE2: 450, FISAE2: 450, FIAE2: 450,
  NIMC: 340, NIQC: 340, NISAC: 340, NIAC: 340,
  NIMC2: 380, NIQC2: 380, NISAC2: 380, NIAC2: 380,
  FIMC: 650, FIQC: 650, FISAC: 650, FIAC: 650,
  IIMR: 1250, IIQR: 1250, IISAR: 1250, IIAR: 1250,
};

function getMultiplier(mopCode) {
  const code = mopCode.toUpperCase();
  if (code.includes("IQE") || code.includes("IQC") || code.includes("IQR") || code === "NIQC" || code === "NIQC2" || code === "IIQR") return 3;
  if (code.includes("SAE") || code.includes("SAC") || code.includes("SAR") || code === "NISAC" || code === "NISAC2" || code === "IISAR") return 6;
  if (code.includes("IAE") || code.includes("IAC") || code.includes("IAR") || code === "NIAC" || code === "NIAC2" || code === "IIAR") return 12;
  return 1;
}

async function main() {
  // Get all members with quarterly/semi-annual/annual MOP codes
  const members = await db.member.findMany({
    where: {
      mopCode: { notIn: ["FIME", "FIME2", "NIMC", "NIMC2", "FIMC", "IIMR", "SPOT_CASH"] },
    },
    select: { id: true, mafNo: true, firstName: true, lastName: true, mopCode: true, monthlyDue: true },
  });

  console.log(`Found ${members.length} members with non-monthly MOP codes\n`);

  let totalFixed = 0;
  let totalMembers = 0;

  for (const m of members) {
    const multiplier = getMultiplier(m.mopCode);
    if (multiplier <= 1) continue; // skip monthly

    const monthlyBase = Number(m.monthlyDue);
    const correctPerInstallment = Math.round(monthlyBase * 0.9 * 100) / 100; // 10% discount

    // Get all non-free payments for this member that have the wrong (undiscounted) amount
    const payments = await db.payment.findMany({
      where: {
        memberId: m.id,
        isFree: false,
        amount: monthlyBase, // payments still at full monthly rate (wrong)
      },
      select: { id: true, amount: true, installmentNo: true, periodMonth: true, periodYear: true },
    });

    if (payments.length === 0) continue;

    totalMembers++;
    console.log(`MAF ${m.mafNo} (${m.firstName} ${m.lastName}) — ${m.mopCode} — ${payments.length} payments at ₱${monthlyBase} → should be ₱${correctPerInstallment}`);

    for (const p of payments) {
      await db.payment.update({
        where: { id: p.id },
        data: { amount: correctPerInstallment },
      });
      totalFixed++;
    }

    console.log(`  → Fixed ${payments.length} payments`);
  }

  console.log(`\nDone! Fixed ${totalFixed} payments across ${totalMembers} members.`);
}

main().catch(console.error).finally(() => db.$disconnect());
