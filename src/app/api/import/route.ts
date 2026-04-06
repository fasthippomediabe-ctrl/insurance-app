import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMonthlyDue, getTotalPlanAmount } from "@/lib/utils";
import { MopCode, PlanCategory, MemberStatus } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────

function clean(v: string | undefined | null): string {
  return (v ?? "").trim().replace(/\s+/g, " ");
}

function parseMopCode(raw: string): MopCode | null {
  const s = clean(raw).toUpperCase().replace(/[\s\-\.]/g, "");
  const map: Record<string, MopCode> = {
    "FIME": "FIME", "FIQE": "FIQE", "FISAE": "FISAE", "FIAE": "FIAE",
    "FIME2": "FIME2", "FIQE2": "FIQE2", "FISAE2": "FISAE2", "FIAE2": "FIAE2",
    "NIMC": "NIMC", "NIQC": "NIQC", "NISAC": "NISAC", "NIAC": "NIAC",
    "NIMC2": "NIMC2", "NIQC2": "NIQC2", "NISAC2": "NISAC2", "NIAC2": "NIAC2",
    "FIMC": "FIMC", "FIQC": "FIQC", "FISAC": "FISAC", "FIAC": "FIAC",
    "IIMR": "IIMR", "IIQR": "IIQR", "IISAR": "IISAR", "IIAR": "IIAR",
    "SPOT": "SPOT_CASH", "SPOTCASH": "SPOT_CASH", "SPOT_CASH": "SPOT_CASH",
    // Handle the "2x" suffix variants
    "FIME2X": "FIME2", "FIQE2X": "FIQE2", "FISAE2X": "FISAE2", "FIAE2X": "FIAE2",
    "NIMC2X": "NIMC2", "NIQC2X": "NIQC2", "NISAC2X": "NISAC2", "NIAC2X": "NIAC2",
  };
  return map[s] ?? null;
}

function parsePlanCategory(raw: string): PlanCategory | null {
  const s = clean(raw).toUpperCase();
  if (s.includes("EUCALYPTUS") || s === "EUC" || s === "E") return "EUCALYPTUS";
  if (s.includes("CHERRY") || s === "CHR" || s === "C") return "CHERRY";
  if (s.includes("CONIFER") || s === "CON") return "CONIFER";
  if (s.includes("ROSEWOOD") || s === "ROSE") return "ROSEWOOD";
  return null;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = clean(raw);
  if (!s || s === "N/A" || s === "0" || s === "-" || s.length < 4) return null;

  // Handle MM-DD-YY or MM/DD/YY format
  const parts = s.split(/[-\/]/);
  if (parts.length === 3) {
    let [m, d, y] = parts.map(Number);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date;
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseStatus(raw: string): MemberStatus {
  const s = clean(raw).toUpperCase();
  if (s.includes("LAPSED") || s === "INACTIVE") return "LAPSED";
  if (s.includes("REINSTATED") || s.includes("REINSTATE")) return "REINSTATED";
  if (s.includes("FULLY") || s.includes("COMPLETED") || s.includes("PAID")) return "FULLY_PAID";
  if (s.includes("DECEASED")) return "DECEASED_CLAIMANT";
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s === "ACTIVE") return "ACTIVE";
  return "ACTIVE";
}

function parseInsuranceType(raw: string): "FAMILY_INSURANCE" | "NON_INSURABLE" | "INDIVIDUAL_INSURANCE" {
  const s = clean(raw).toUpperCase();
  if (s.includes("NON")) return "NON_INSURABLE";
  if (s.includes("INDIVIDUAL")) return "INDIVIDUAL_INSURANCE";
  return "FAMILY_INSURANCE";
}

function deriveMopCode(code: string, mop: string, plan: string): MopCode | null {
  // Try the Code column first (e.g., "FIME", "NIQC")
  const fromCode = parseMopCode(code);
  if (fromCode) return fromCode;

  // Try the MOP column
  const fromMop = parseMopCode(mop);
  if (fromMop) return fromMop;

  // Derive from Plan Category + MOP frequency
  const planCat = parsePlanCategory(plan);
  const freq = clean(mop).toUpperCase();

  if (planCat === "EUCALYPTUS") {
    if (freq.includes("QUARTER")) return "FIQE";
    if (freq.includes("SEMI")) return "FISAE";
    if (freq.includes("YEAR") || freq.includes("ANNUAL")) return "FIAE";
    if (freq.includes("SPOT")) return "SPOT_CASH";
    return "FIME"; // default monthly
  }
  if (planCat === "CHERRY") {
    if (freq.includes("QUARTER")) return "NIQC";
    if (freq.includes("SEMI")) return "NISAC";
    if (freq.includes("YEAR") || freq.includes("ANNUAL")) return "NIAC";
    if (freq.includes("SPOT")) return "SPOT_CASH";
    return "NIMC";
  }
  if (planCat === "CONIFER") {
    if (freq.includes("QUARTER")) return "FIQC";
    if (freq.includes("SEMI")) return "FISAC";
    if (freq.includes("YEAR") || freq.includes("ANNUAL")) return "FIAC";
    if (freq.includes("SPOT")) return "SPOT_CASH";
    return "FIMC";
  }
  return null;
}

// Find or create employee by name
async function resolveEmployee(
  name: string,
  branchId: string,
  position: "MO" | "AO",
  cache: Map<string, string>
): Promise<string | undefined> {
  if (!name || name === "0") return undefined;
  // "transferred" means the account moved to another branch — not a real employee
  const upper = name.toUpperCase().trim();
  if (upper === "TRANSFERRED" || upper === "TRANSFER") return undefined;
  const key = `${name.toUpperCase()}-${position}`;
  if (cache.has(key)) return cache.get(key)!;

  // Parse name — could be "FIRST LAST" or "FIRST MIDDLE LAST"
  const parts = clean(name).split(/\s+/);
  let firstName = "", lastName = "";
  if (parts.length === 1) {
    firstName = parts[0]; lastName = parts[0];
  } else if (parts.length === 2) {
    firstName = parts[0]; lastName = parts[1];
  } else {
    firstName = parts[0]; lastName = parts[parts.length - 1];
  }

  // Try exact match first
  let emp = await db.employee.findFirst({
    where: {
      branchId,
      firstName: { contains: firstName, mode: "insensitive" },
      lastName: { contains: lastName, mode: "insensitive" },
    },
  });

  if (!emp) {
    // Create new employee
    const no = `EMP-${firstName[0] ?? "X"}${lastName[0] ?? "X"}-${Date.now()}`;
    emp = await db.employee.create({
      data: {
        employeeNo: no,
        firstName,
        lastName,
        primaryPosition: position,
        branchId,
        isActive: true,
      },
    });
  }

  cache.set(key, emp.id);
  return emp.id;
}

// ─── Column key finder (handles messy CSV headers) ──
function findCol(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    // Exact match
    if (row[c] !== undefined) return row[c];
    // Case-insensitive
    const keys = Object.keys(row);
    const found = keys.find(k => k.trim().toLowerCase() === c.toLowerCase());
    if (found && row[found] !== undefined) return row[found];
    // Partial match
    const partial = keys.find(k => k.toLowerCase().includes(c.toLowerCase()));
    if (partial && row[partial] !== undefined) return row[partial];
  }
  return "";
}

// ─── MAIN HANDLER ────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { rows, branchId, importType } = body as {
    rows: Record<string, string>[];
    branchId: string;
    importType: "members" | "payments";
  };

  if (!rows || !branchId) {
    return NextResponse.json({ error: "Missing rows or branchId" }, { status: 400 });
  }

  if (importType === "payments") {
    return importPayments(rows, branchId);
  }
  return importMembers(rows, branchId);
}

// ─── IMPORT MEMBERS ──────────────────────────────

async function importMembers(rows: Record<string, string>[], branchId: string) {
  const results = { created: 0, skipped: 0, errors: [] as string[] };
  const empCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Your CSV columns: (blank), MAF, DATE, INSURANCE TYPE, Plan Category, MOP, Code, FIRST NAME, Middle Name, LAST NAME, Sales Agent, COLLECTOR, ...
      const mafNo = clean(findCol(row, "MAF", "MAF No.", "MAF_NO", " MAF"));
      if (!mafNo || mafNo === "0" || mafNo.length > 20) { results.skipped++; continue; }

      const existing = await db.member.findUnique({ where: { mafNo } });
      if (existing) { results.skipped++; continue; }

      const firstName = clean(findCol(row, "FIRST NAME", "First Name"));
      const lastName = clean(findCol(row, "LAST NAME", "Last Name"));
      if (!firstName && !lastName) { results.skipped++; continue; }

      const planRaw = findCol(row, "Plan Category", "PLAN CATEGORY", "Plan");
      const mopRaw = findCol(row, "MOP", "Mode of Payment");
      const codeRaw = findCol(row, "Code", "MOP Code");
      const insuranceTypeRaw = findCol(row, "INSURANCE TYPE", "Insurance Type");
      const statusRaw = findCol(row, "INSURANCE TYPE", "Insurance Type"); // "Lapsed Account", "Family Insurance", "Reinstated"

      // Derive MOP code
      let mopCode = deriveMopCode(codeRaw, mopRaw, planRaw);

      // Handle Spot Cash from MOP column
      if (mopRaw.toUpperCase().includes("SPOT")) mopCode = "SPOT_CASH";

      if (!mopCode) {
        results.errors.push(`Row ${i + 1} (MAF ${mafNo}): can't determine MOP code from Code="${codeRaw}", MOP="${mopRaw}", Plan="${planRaw}"`);
        continue;
      }

      const planCategory = parsePlanCategory(planRaw) ?? "EUCALYPTUS";
      const enrollmentDate = parseDate(findCol(row, "DATE", "Date")) ?? new Date();

      // Resolve agent and collector
      const agentName = clean(findCol(row, "Sales Agent"));
      const collectorName = clean(findCol(row, "COLLECTOR", "Collector"));

      const agentId = await resolveEmployee(agentName, branchId, "MO", empCache);
      const collectorId = await resolveEmployee(collectorName, branchId, "AO", empCache);

      // Determine status from "INSURANCE TYPE" column which has values like "Lapsed Account", "Family Insurance", "Reinstated"
      let status: MemberStatus = "ACTIVE";
      const insTypeUpper = clean(insuranceTypeRaw).toUpperCase();
      if (insTypeUpper.includes("LAPSED")) status = "LAPSED";
      else if (insTypeUpper.includes("REINSTATED") || insTypeUpper.includes("REINSTATE")) status = "REINSTATED";
      else if (insTypeUpper.includes("FAMILY") || insTypeUpper.includes("INSURANCE")) status = "ACTIVE";

      // Parse insurance type properly
      let insuranceType: "FAMILY_INSURANCE" | "NON_INSURABLE" | "INDIVIDUAL_INSURANCE" = "FAMILY_INSURANCE";
      if (codeRaw.toUpperCase().startsWith("NI") || planCategory === "CHERRY") insuranceType = "NON_INSURABLE";
      else if (codeRaw.toUpperCase().startsWith("II")) insuranceType = "INDIVIDUAL_INSURANCE";

      const monthlyDue = getMonthlyDue(mopCode);
      const totalPlanAmount = getTotalPlanAmount(mopCode);
      const isSpotCash = mopCode === "SPOT_CASH";

      // Operation month/year from enrollment date
      const opMonth = enrollmentDate.getMonth() + 1;
      const opYear = enrollmentDate.getFullYear();

      const member = await db.member.create({
        data: {
          mafNo,
          enrollmentDate,
          effectivityDate: enrollmentDate,
          insuranceType,
          planCategory,
          mopCode,
          firstName,
          middleName: clean(findCol(row, "Middle Name/Initial", "Middle Name", "Middle")) || undefined,
          lastName,
          address: clean(findCol(row, "Complete Address", "Address")) || "",
          dateOfBirth: parseDate(findCol(row, "Date Of Birth", "DOB", "Date of Birth")) ?? undefined,
          age: parseInt(findCol(row, "Age")) || undefined,
          religion: clean(findCol(row, "Religion")) || undefined,
          contactNumber: clean(findCol(row, "Contact Number", "Contact")) || undefined,
          occupation: clean(findCol(row, "Occupation")) || undefined,
          civilStatus: clean(findCol(row, "Civil Status")) || undefined,
          gender: findCol(row, "Gender").toUpperCase().includes("MALE") && !findCol(row, "Gender").toUpperCase().includes("FEMALE") ? "MALE"
                : findCol(row, "Gender").toUpperCase().includes("FEMALE") ? "FEMALE"
                : undefined,
          monthlyDue,
          totalPlanAmount,
          spotCash: isSpotCash,
          status,
          operationMonth: opMonth,
          operationYear: opYear,
          branchId,
          agentId,
          collectorId,
        },
      });

      // Beneficiaries — your CSV has: 1st Beneficiary (Name, DOB, Age, Relationship, Effectivity Date)
      // The header structure groups them, so we look for specific patterns
      const benKeys = Object.keys(row);

      // Try to find beneficiary data by looking for "Name" columns after "Gender"
      // Pattern: columns with "Name", "Date Of Birth", "Age", "Relationship", "Effectivity Date" repeated 3 times
      const nameColIndices: number[] = [];
      for (let k = 0; k < benKeys.length; k++) {
        const key = benKeys[k].toLowerCase();
        if (key === "name" || (key.includes("name") && !key.includes("first") && !key.includes("last") && !key.includes("middle") && k > 15)) {
          nameColIndices.push(k);
        }
      }

      // Alternatively, look for the structured beneficiary columns
      for (let b = 1; b <= 3; b++) {
        let benName = "";
        let benDob = "";
        let benAge = "";
        let benRel = "";
        let benEff = "";

        // Try numbered pattern: Beneficiary1_Name, etc.
        benName = clean(findCol(row, `Beneficiary${b}_Name`, `Benef${b}_Name`, `Ben${b}_Name`));
        benDob = findCol(row, `Beneficiary${b}_DOB`, `Benef${b}_DOB`);
        benAge = findCol(row, `Beneficiary${b}_Age`, `Benef${b}_Age`);
        benRel = clean(findCol(row, `Beneficiary${b}_Relationship`, `Benef${b}_Rel`));
        benEff = findCol(row, `Beneficiary${b}_Effectivity`, `Benef${b}_Eff`);

        // If not found, try positional approach from the CSV
        // The Enrollee CSV has repeated column groups for each beneficiary
        if (!benName && nameColIndices.length >= b) {
          const idx = nameColIndices[b - 1];
          benName = clean(row[benKeys[idx]] ?? "");
          benDob = row[benKeys[idx + 1]] ?? "";
          benAge = row[benKeys[idx + 2]] ?? "";
          benRel = clean(row[benKeys[idx + 3]] ?? "");
          benEff = row[benKeys[idx + 4]] ?? "";
        }

        if (benName) {
          const nameParts = benName.split(/\s+/);
          const bFirstName = nameParts.slice(0, -1).join(" ") || nameParts[0];
          const bLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

          await db.beneficiary.create({
            data: {
              memberId: member.id,
              order: b,
              firstName: bFirstName,
              lastName: bLastName,
              dateOfBirth: parseDate(benDob) ?? undefined,
              age: parseInt(benAge) || undefined,
              relationship: benRel || "Unknown",
              effectivityDate: parseDate(benEff) ?? undefined,
            },
          });
        }
      }

      results.created++;
    } catch (err: any) {
      results.errors.push(`Row ${i + 1}: ${err.message?.slice(0, 200)}`);
    }
  }

  return NextResponse.json(results);
}

// ─── IMPORT PAYMENTS ─────────────────────────────

// Month column mapping: "April21" → { month: 4, year: 2021 }
const MONTH_NAMES: Record<string, number> = {
  "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
  "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
  "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
  "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
};

function parseMonthColumn(colName: string): { month: number; year: number } | null {
  const s = colName.trim().toLowerCase();
  // Match patterns: "April21", "May21", "Jan22", "Sept22", "Augu21", etc.
  const match = s.match(/^([a-z]+?)(\d{2,4})$/);
  if (!match) return null;
  let [, monthStr, yearStr] = match;

  // Normalize month abbreviations
  monthStr = monthStr.replace(/u$/, "").replace(/t$/, ""); // "augu" → "aug", "sept" → "sep"

  let monthNum = MONTH_NAMES[monthStr];
  if (!monthNum) {
    // Try first 3 chars
    monthNum = MONTH_NAMES[monthStr.slice(0, 3)];
  }
  if (!monthNum) return null;

  let year = parseInt(yearStr);
  if (year < 100) year += 2000;

  return { month: monthNum, year };
}

async function importPayments(rows: Record<string, string>[], branchId: string) {
  const results = { created: 0, skipped: 0, errors: [] as string[] };

  // First, identify which columns are month columns
  if (rows.length === 0) return NextResponse.json(results);

  const allKeys = Object.keys(rows[0]);
  const monthColumns: { key: string; month: number; year: number }[] = [];

  for (const key of allKeys) {
    const parsed = parseMonthColumn(key);
    if (parsed) {
      monthColumns.push({ key, ...parsed });
    }
  }

  if (monthColumns.length === 0) {
    return NextResponse.json({ ...results, errors: ["No month columns found in CSV. Expected columns like 'April21', 'May21', etc."] });
  }

  // Sort month columns chronologically
  monthColumns.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const mafNo = clean(findCol(row, " MAF No.", "MAF No.", "MAF_NO", "MAF"));
      if (!mafNo || mafNo === "0" || mafNo.length > 20) { results.skipped++; continue; }

      // Find the member
      const member = await db.member.findUnique({ where: { mafNo } });
      if (!member) {
        results.errors.push(`Row ${i + 1} (MAF ${mafNo}): member not found. Import members first.`);
        continue;
      }

      // Check status from CSV
      const statusRaw = clean(findCol(row, "Status")).toUpperCase();
      const hasFree = clean(findCol(row, "FREE")).toUpperCase();

      // Parse the "Comm" or "NComm" flag
      const commFlag = clean(findCol(row, "COLLECTED BY")).toUpperCase() || "";
      // Actually the CSV has a column after Total Payment that says "Comm" or "NComm"
      // Let's find it by looking at all columns

      // Track installment number as we go through months chronologically
      let installmentNo = 0;
      let hasFreeMonth = false;

      // Check if FREE column has a value (420 means first month amount is free)
      const freeVal = clean(findCol(row, "FREE"));
      if (freeVal && parseFloat(freeVal) > 0) {
        hasFreeMonth = true;
      }

      // Get existing payments for this member to avoid duplicates
      const existingPayments = await db.payment.findMany({
        where: { memberId: member.id },
        select: { periodMonth: true, periodYear: true, installmentNo: true },
      });
      const existingKey = new Set(existingPayments.map(p => `${p.periodYear}-${p.periodMonth}`));

      // If member already has payments, skip (don't double import)
      if (existingPayments.length > 0) {
        results.skipped++;
        continue;
      }

      // If FREE column has a value, create free installment(s)
      // FREE could be 1 month (e.g., 420) or multiple months bought out from another company (e.g., 3360 = 8 x 420)
      if (hasFreeMonth) {
        const freeAmount = parseFloat(freeVal.replace(/,/g, ""));
        const monthlyDue = Number(member.monthlyDue);
        // Calculate how many free months this covers
        let freeMonths = 1;
        if (monthlyDue > 0 && freeAmount > 0) {
          freeMonths = Math.round(freeAmount / monthlyDue);
          if (freeMonths < 1) freeMonths = 1;
        }

        const enrollDate = member.enrollmentDate;
        for (let f = 0; f < freeMonths; f++) {
          installmentNo++;
          // Each free month covers a period starting from enrollment
          const freeDate = new Date(enrollDate);
          freeDate.setMonth(freeDate.getMonth() + f);

          await db.payment.create({
            data: {
              memberId: member.id,
              installmentNo,
              periodMonth: freeDate.getMonth() + 1,
              periodYear: freeDate.getFullYear(),
              paymentDate: enrollDate,
              amount: 0,
              isFree: true,
              notes: freeMonths > 1 ? `Buyout from previous company (${f + 1}/${freeMonths})` : "Free month",
            },
          });
          results.created++;
        }
      }

      // Process each month column
      for (const mc of monthColumns) {
        const rawVal = clean(row[mc.key]).replace(/,/g, "").replace(/â±/g, "").replace(/"/g, "");
        if (!rawVal || rawVal === "0" || rawVal === "") continue;

        const amount = parseFloat(rawVal);
        if (isNaN(amount) || amount <= 0) continue;

        // Calculate how many installments this payment covers
        const monthlyDue = Number(member.monthlyDue);
        let installments = 1;
        if (monthlyDue > 0) {
          installments = Math.round(amount / monthlyDue);
          if (installments < 1) installments = 1;
        }

        // Create payment(s) for this month
        for (let inst = 0; inst < installments; inst++) {
          installmentNo++;

          await db.payment.create({
            data: {
              memberId: member.id,
              installmentNo,
              periodMonth: mc.month,
              periodYear: mc.year,
              paymentDate: new Date(mc.year, mc.month - 1, 15), // mid-month as approx
              amount: monthlyDue || amount / installments,
              isFree: false,
            },
          });
          results.created++;
        }
      }

      // Update member status based on CSV
      if (statusRaw.includes("INACTIVE") || statusRaw.includes("LAPSED")) {
        await db.member.update({
          where: { id: member.id },
          data: { status: "LAPSED" },
        });
      } else if (statusRaw.includes("ACTIVE") && installmentNo >= 60) {
        await db.member.update({
          where: { id: member.id },
          data: { status: "FULLY_PAID" },
        });
      }

    } catch (err: any) {
      results.errors.push(`Row ${i + 1}: ${err.message?.slice(0, 200)}`);
    }
  }

  return NextResponse.json(results);
}
