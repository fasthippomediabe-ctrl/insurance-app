/**
 * Import March 2026 payments from CSV into database
 * Usage: node scripts/import-march26.js
 */

const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();
const CSV_PATH = "C:/Users/Bryan/Downloads/KIDAPAWAN MAIN- TRIPLE J Plan Holders - Plan Holders Payment Records (2).csv";

async function main() {
  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = text.split("\n").map(l => l.replace(/\r$/, ""));
  const headers = lines[0].split(",");

  // Find column indices
  const mar26Idx = headers.findIndex(h => h.trim().toLowerCase() === "mar26");
  const mafIdx = 2; // Column C based on CSV structure: No, Status, MAF No.

  // Find COLLECTED BY column
  const collectedByIdx = headers.findIndex(h => h.trim().toUpperCase().includes("COLLECTED BY"));

  console.log(`Mar26 column index: ${mar26Idx}`);
  console.log(`MAF column index: ${mafIdx} ("${headers[mafIdx].trim()}")`);
  console.log(`COLLECTED BY column index: ${collectedByIdx}`);

  // Parse entries
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple split - handles most cases. For quoted values, clean up
    const vals = [];
    let current = "", inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { vals.push(current); current = ""; }
      else { current += ch; }
    }
    vals.push(current);

    const mafNo = (vals[mafIdx] || "").trim();
    if (!mafNo || mafNo.length > 20 || !/\d/.test(mafNo)) continue;
    // Skip junk rows (Total, FIME, etc.)
    if (/^[a-z]/i.test(mafNo) && !/^\d/.test(mafNo)) continue;

    const rawVal = (vals[mar26Idx] || "").trim().replace(/,/g, "").replace(/"/g, "");
    if (!rawVal || rawVal === "0") continue;

    const amount = parseFloat(rawVal);
    if (isNaN(amount) || amount <= 0) continue;

    const collectorName = collectedByIdx >= 0 ? (vals[collectedByIdx] || "").trim() : "";

    entries.push({ mafNo, amount, collectorName, line: i + 1 });
  }

  console.log(`\nFound ${entries.length} members with March 2026 payments\n`);

  // Show samples
  console.log("First 15 entries:");
  entries.slice(0, 15).forEach(e =>
    console.log(`  MAF ${e.mafNo}: ₱${e.amount}${e.collectorName ? ` (${e.collectorName})` : ""}`)
  );

  // Insert into database
  let created = 0, skipped = 0, notFound = 0;
  const errors = [];
  const collectorCache = new Map();

  for (const entry of entries) {
    try {
      const member = await db.member.findUnique({
        where: { mafNo: entry.mafNo },
        select: { id: true, monthlyDue: true, status: true },
      });

      if (!member) {
        notFound++;
        errors.push(`MAF ${entry.mafNo} (line ${entry.line}): not found in DB`);
        continue;
      }

      // Check existing
      const existing = await db.payment.findFirst({
        where: { memberId: member.id, periodMonth: 3, periodYear: 2026, isFree: false },
      });
      if (existing) { skipped++; continue; }

      // Max installment
      const maxInst = await db.payment.aggregate({
        where: { memberId: member.id },
        _max: { installmentNo: true },
      });
      let nextInst = (maxInst._max.installmentNo ?? 0) + 1;

      // Installment count
      const monthlyDue = Number(member.monthlyDue);
      let instCount = 1;
      if (monthlyDue > 0 && entry.amount > monthlyDue * 1.3) {
        instCount = Math.round(entry.amount / monthlyDue);
        if (instCount < 1) instCount = 1;
      }

      // Resolve collector
      let collectorId = null;
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

      // Create payments
      for (let j = 0; j < instCount; j++) {
        await db.payment.create({
          data: {
            memberId: member.id,
            installmentNo: nextInst + j,
            periodMonth: 3,
            periodYear: 2026,
            paymentDate: new Date(2026, 2, 15),
            amount: monthlyDue > 0 ? monthlyDue : entry.amount / instCount,
            isFree: false,
            ...(collectorId ? { collectorId } : {}),
          },
        });
        created++;
      }

      // Reactivate if lapsed
      if (member.status === "LAPSED") {
        await db.member.update({
          where: { id: member.id },
          data: { status: "ACTIVE" },
        });
      }

    } catch (err) {
      errors.push(`MAF ${entry.mafNo}: ${err.message?.slice(0, 200)}`);
    }
  }

  console.log(`\n========= RESULTS =========`);
  console.log(`Payment records created: ${created}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Members not found in DB:  ${notFound}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0 && errors.length <= 30) {
    console.log("\nError details:");
    errors.forEach(e => console.log(`  ${e}`));
  } else if (errors.length > 30) {
    console.log("\nFirst 30 errors:");
    errors.slice(0, 30).forEach(e => console.log(`  ${e}`));
    console.log(`  ... and ${errors.length - 30} more`);
  }

  await db.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
