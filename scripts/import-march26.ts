/**
 * Script to parse the CSV and extract March 2026 payments,
 * then POST them to /api/import/update-month
 *
 * Usage: npx tsx scripts/import-march26.ts
 */

import fs from "fs";
import path from "path";

const CSV_PATH = path.resolve("C:/Users/Bryan/Downloads/KIDAPAWAN MAIN- TRIPLE J Plan Holders - Plan Holders Payment Records (2).csv");

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").map(l => l.replace(/\r$/, ""));
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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
  const rows = parseCSV(text);

  console.log(`Parsed ${rows.length} rows from CSV`);

  // Find the Mar26 column
  const headers = Object.keys(rows[0] || {});
  const mar26Col = headers.find(h => {
    const lower = h.trim().toLowerCase();
    return lower === "mar26" || lower === "march26";
  });

  if (!mar26Col) {
    console.error("Could not find Mar26 column. Available columns:", headers.filter(h => h.match(/\d{2}$/)).join(", "));
    process.exit(1);
  }

  console.log(`Found March 2026 column: "${mar26Col}"`);

  // Also find the "COLLECTED BY" column for the collector
  const collectedByCol = headers.find(h => h.trim().toUpperCase().includes("COLLECTED BY"));

  // Extract entries with March 2026 payments
  const entries: { mafNo: string; amount: number; collectorName?: string }[] = [];

  for (const row of rows) {
    // Get MAF No
    const mafNo = (row[" MAF No."] || row["MAF No."] || row["MAF_NO"] || row["MAF"] || "").trim();
    if (!mafNo || mafNo === "0" || mafNo.length > 20) continue;

    // Get Mar26 value
    const rawVal = (row[mar26Col] || "").trim().replace(/,/g, "").replace(/"/g, "").replace(/â±/g, "");
    if (!rawVal || rawVal === "0" || rawVal === "") continue;

    const amount = parseFloat(rawVal);
    if (isNaN(amount) || amount <= 0) continue;

    // Get collector name
    const collectorName = collectedByCol ? (row[collectedByCol] || "").trim() : undefined;

    entries.push({ mafNo, amount, collectorName: collectorName || undefined });
  }

  console.log(`Found ${entries.length} members with March 2026 payments`);

  if (entries.length === 0) {
    console.log("No March 2026 payments to import.");
    return;
  }

  // Print sample entries
  console.log("\nSample entries:");
  for (const e of entries.slice(0, 10)) {
    console.log(`  MAF ${e.mafNo}: ₱${e.amount}${e.collectorName ? ` (${e.collectorName})` : ""}`);
  }

  console.log(`\nTotal entries to import: ${entries.length}`);
  console.log(JSON.stringify({ count: entries.length, entries }, null, 2));
}

main().catch(console.error);
