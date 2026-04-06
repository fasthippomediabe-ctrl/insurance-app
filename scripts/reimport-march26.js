/**
 * Force re-import March 2026 payments from CSV
 * Fixes:
 * 1. Use member's assigned collector when CSV doesn't specify one
 * 2. Handle quarterly/semi-annual/annual amounts correctly (10% discount)
 *
 * Usage: node scripts/reimport-march26.js
 */

const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();
const CSV_PATH = "C:/Users/Bryan/Downloads/KIDAPAWAN MAIN- TRIPLE J Plan Holders - Plan Holders Payment Records (2).csv";

function parseCSVLine(line) {
  const result = [];
  let current = "", inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// Payment frequency: how many installments does one payment cover?
function getMultiplier(mopCode) {
  const code = (mopCode || "").toUpperCase();
  if (code.includes("IQE") || code.includes("IQC") || code.includes("IQR") || code === "NIQC" || code === "NIQC2" || code === "IIQR") return 3;
  if (code.includes("SAE") || code.includes("SAC") || code.includes("SAR") || code === "NISAC" || code === "NISAC2" || code === "IISAR") return 6;
  if (code.includes("IAE") || code.includes("IAC") || code.includes("IAR") || code === "NIAC" || code === "NIAC2" || code === "IIAR") return 12;
  return 1;
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = text.split("\n").map(l => l.replace(/\r$/, ""));
  const headers = lines[0].split(",");

  const mar26Idx = headers.findIndex(h => h.trim().toLowerCase() === "mar26");
  const mafIdx = 2;
  const collectedByIdx = headers.findIndex(h => h.trim().toUpperCase().includes("COLLECTED BY"));

  console.log(`Mar26 column: index ${mar26Idx}`);

  // Step 1: Delete ALL existing March 2026 non-free payments
  const deleted = await db.payment.deleteMany({
    where: { periodMonth: 3, periodYear: 2026, isFree: false },
  });
  console.log(`Deleted ${deleted.count} existing March 2026 payment records\n`);

  // Step 2: Parse CSV entries
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);

    const mafNo = (vals[mafIdx] || "").trim();
    if (!mafNo || mafNo.length > 20 || !/\d/.test(mafNo)) continue;
    if (/^[a-z]/i.test(mafNo) && !/^\d/.test(mafNo)) continue;

    const rawVal = (vals[mar26Idx] || "").trim().replace(/,/g, "").replace(/"/g, "");
    if (!rawVal || rawVal === "0") continue;

    const amount = parseFloat(rawVal);
    if (isNaN(amount) || amount <= 0) continue;

    const collectorName = collectedByIdx >= 0 ? (vals[collectedByIdx] || "").trim() : "";
    entries.push({ mafNo, amount, collectorName, line: i + 1 });
  }

  console.log(`Found ${entries.length} members with March 2026 payments\n`);

  // Step 3: Re-create payments
  let created = 0, notFound = 0;
  const errors = [];
  const collectorCache = new Map();

  for (const entry of entries) {
    try {
      const member = await db.member.findUnique({
        where: { mafNo: entry.mafNo },
        select: { id: true, monthlyDue: true, mopCode: true, status: true, collectorId: true },
      });

      if (!member) {
        notFound++;
        errors.push(`MAF ${entry.mafNo} (line ${entry.line}): not found`);
        continue;
      }

      // Get max installment
      const maxInst = await db.payment.aggregate({
        where: { memberId: member.id },
        _max: { installmentNo: true },
      });
      let nextInst = (maxInst._max.installmentNo ?? 0) + 1;

      // Calculate installment count based on MOP frequency
      const monthlyDue = Number(member.monthlyDue);
      const multiplier = getMultiplier(member.mopCode);
      let instCount = 1;

      if (monthlyDue > 0) {
        if (multiplier > 1) {
          // Quarterly/Semi-Annual/Annual: payment = monthlyDue × multiplier × 0.9 (10% discount)
          const expectedPayment = monthlyDue * multiplier * 0.9;
          if (Math.abs(entry.amount - expectedPayment) < monthlyDue * 0.5) {
            // Matches one frequency payment → covers `multiplier` installments
            instCount = multiplier;
          } else if (entry.amount > expectedPayment * 1.3) {
            // Multiple frequency payments (e.g., 2 quarterly payments in one month)
            instCount = Math.round(entry.amount / (monthlyDue * 0.9)) || multiplier;
          } else {
            // Partial or irregular — fall back to dividing by monthly due
            instCount = Math.round(entry.amount / monthlyDue);
            if (instCount < 1) instCount = 1;
          }
        } else {
          // Monthly: divide by monthly due
          if (entry.amount > monthlyDue * 1.3) {
            instCount = Math.round(entry.amount / monthlyDue);
            if (instCount < 1) instCount = 1;
          }
        }
      }

      // Amount per installment
      const amountPerInst = instCount > 0 ? entry.amount / instCount : entry.amount;

      // Resolve collector: use CSV collector, or fall back to member's assigned collector
      let collectorId = member.collectorId; // default: member's assigned collector

      if (entry.collectorName && entry.collectorName.length > 2) {
        if (collectorCache.has(entry.collectorName)) {
          collectorId = collectorCache.get(entry.collectorName);
        } else {
          const parts = entry.collectorName.split(/\s+/);
          if (parts.length >= 2) {
            const collector = await db.employee.findFirst({
              where: {
                firstName: { contains: parts[0], mode: "insensitive" },
                lastName: { contains: parts[parts.length - 1], mode: "insensitive" },
              },
              select: { id: true },
            });
            if (collector) {
              collectorId = collector.id;
              collectorCache.set(entry.collectorName, collectorId);
            }
          }
        }
      }

      // Create payment(s)
      for (let j = 0; j < instCount; j++) {
        await db.payment.create({
          data: {
            memberId: member.id,
            installmentNo: nextInst + j,
            periodMonth: 3,
            periodYear: 2026,
            paymentDate: new Date(2026, 2, 15),
            amount: parseFloat(amountPerInst.toFixed(2)),
            isFree: false,
            ...(collectorId ? { collectorId } : {}),
          },
        });
        created++;
      }

    } catch (err) {
      errors.push(`MAF ${entry.mafNo}: ${err.message?.slice(0, 200)}`);
    }
  }

  console.log(`========= RESULTS =========`);
  console.log(`Deleted:   ${deleted.count} old records`);
  console.log(`Created:   ${created} new records`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors:    ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.slice(0, 30).forEach(e => console.log(`  ${e}`));
    if (errors.length > 30) console.log(`  ... and ${errors.length - 30} more`);
  }

  // Verify MAF 11134
  const check = await db.member.findUnique({ where: { mafNo: "11134" }, select: { id: true, mopCode: true, monthlyDue: true } });
  if (check) {
    const payments = await db.payment.findMany({
      where: { memberId: check.id, periodMonth: 3, periodYear: 2026 },
      orderBy: { installmentNo: "asc" },
    });
    console.log(`\n--- Verify MAF 11134 (${check.mopCode}, due=${check.monthlyDue}) ---`);
    payments.forEach(p => console.log(`  Inst #${p.installmentNo}: ₱${Number(p.amount)} (free: ${p.isFree})`));
    console.log(`  Total: ₱${payments.reduce((s, p) => s + Number(p.amount), 0)}`);
  }

  await db.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
