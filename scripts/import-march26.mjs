/**
 * Parse CSV and import March 2026 payments directly into database
 * Usage: node scripts/import-march26.mjs
 */

import fs from "fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CSV_PATH = "C:/Users/Bryan/Downloads/KIDAPAWAN MAIN- TRIPLE J Plan Holders - Plan Holders Payment Records (2).csv";

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = text.split("\n").map(l => l.replace(/\r$/, ""));

  const headers = parseCSVLine(lines[0]);

  // Find Mar26 column index
  const mar26Idx = headers.findIndex(h => h.trim().toLowerCase() === "mar26");
  if (mar26Idx === -1) {
    console.error("Mar26 column not found! Headers with numbers:", headers.filter(h => /\d{2}$/.test(h.trim())).map(h => h.trim()));
    process.exit(1);
  }
  console.log(`Mar26 column found at index ${mar26Idx}`);

  // Find MAF No column (column index 2 based on CSV structure: No, Status, MAF No.)
  const mafIdx = headers.findIndex(h => h.trim().toUpperCase().includes("MAF"));
  console.log(`MAF column found at index ${mafIdx}: "${headers[mafIdx]}"`);

  // Find COLLECTED BY column
  const collectedByIdx = headers.findIndex(h => h.trim().toUpperCase().includes("COLLECTED BY"));
  console.log(`COLLECTED BY column at index ${collectedByIdx}`);

  // Parse all rows and extract March 2026 payments
  const entries = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);

    const mafNo = (vals[mafIdx] || "").trim();
    if (!mafNo || mafNo === "0" || mafNo.length > 20 || /^[a-z]/i.test(mafNo) && !/^\d/.test(mafNo)) continue;
    // Skip non-numeric MAF numbers (like "Total", "FIME", etc.)
    if (!/\d/.test(mafNo)) continue;

    const rawVal = (vals[mar26Idx] || "").trim().replace(/,/g, "").replace(/"/g, "").replace(/â±/g, "").replace(/₱/g, "");
    if (!rawVal || rawVal === "0" || rawVal === "") continue;

    const amount = parseFloat(rawVal);
    if (isNaN(amount) || amount <= 0) continue;

    const collectorName = collectedByIdx >= 0 ? (vals[collectedByIdx] || "").trim() : "";

    entries.push({ mafNo, amount, collectorName, lineNo: i + 1 });
  }

  console.log(`\nFound ${entries.length} members with March 2026 payments`);
  console.log("\nSample:");
  entries.slice(0, 15).forEach(e => console.log(`  MAF ${e.mafNo}: ₱${e.amount}${e.collectorName ? ` (collector: ${e.collectorName})` : ""}`));

  // Now insert into database
  let created = 0, skipped = 0, errors = [];

  for (const entry of entries) {
    try {
      const member = await db.member.findUnique({
        where: { mafNo: entry.mafNo },
        select: { id: true, monthlyDue: true, status: true },
      });

      if (!member) {
        errors.push(`MAF ${entry.mafNo} (line ${entry.lineNo}): not found`);
        continue;
      }

      // Check if payment already exists for March 2026
      const existing = await db.payment.findFirst({
        where: {
          memberId: member.id,
          periodMonth: 3,
          periodYear: 2026,
          isFree: false,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Get max installment
      const maxInst = await db.payment.aggregate({
        where: { memberId: member.id },
        _max: { installmentNo: true },
      });
      let nextInst = (maxInst._max.installmentNo ?? 0) + 1;

      // Calculate installment count
      const monthlyDue = Number(member.monthlyDue);
      let instCount = 1;
      if (monthlyDue > 0 && entry.amount > monthlyDue * 1.3) {
        instCount = Math.round(entry.amount / monthlyDue);
        if (instCount < 1) instCount = 1;
      }

      // Resolve collector
      let collectorId = null;
      if (entry.collectorName) {
        const parts = entry.collectorName.split(/\s+/);
        if (parts.length >= 2) {
          const collector = await db.employee.findFirst({
            where: {
              firstName: { contains: parts[0], mode: "insensitive" },
              lastName: { contains: parts[parts.length - 1], mode: "insensitive" },
            },
            select: { id: true },
          });
          if (collector) collectorId = collector.id;
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
            amount: monthlyDue > 0 ? monthlyDue : entry.amount / instCount,
            isFree: false,
            ...(collectorId ? { collectorId } : {}),
          },
        });
        created++;
      }

      // Reactivate if LAPSED
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

  console.log(`\n=== Results ===`);
  console.log(`Created: ${created} payment records`);
  console.log(`Skipped: ${skipped} (already had March 2026 payment)`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(e => console.log(`  ${e}`));
  }

  await db.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
