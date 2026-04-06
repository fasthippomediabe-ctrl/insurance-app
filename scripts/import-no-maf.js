/**
 * Import members without MAF numbers from enrollee CSV
 * Auto-generates MAF numbers starting from max+1
 * Usage: node scripts/import-no-maf.js
 */

const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const CSV_PATH = "C:/Users/Bryan/Downloads/KIDAPAWAN MAIN- TRIPLE J Plan Holders - Plan Holder Enrollee's Details (2).csv";

const MOP_MAP = {
  "FIME": "FIME", "FIQE": "FIQE", "FISAE": "FISAE", "FIAE": "FIAE",
  "FIME2": "FIME2", "FIQE2": "FIQE2", "FISAE2": "FISAE2", "FIAE2": "FIAE2",
  "NIMC": "NIMC", "NIQC": "NIQC", "NISAC": "NISAC", "NIAC": "NIAC",
  "NIMC2": "NIMC2", "NIQC2": "NIQC2", "NISAC2": "NISAC2", "NIAC2": "NIAC2",
  "FIMC": "FIMC", "FIQC": "FIQC", "FISAC": "FISAC", "FIAC": "FIAC",
  "SPOT": "SPOT_CASH", "SPOTE": "SPOT_CASH", "SPOT_CASH": "SPOT_CASH",
};

const PLAN_MAP = { "EUCALYPTUS": "EUCALYPTUS", "CHERRY": "CHERRY", "CONIFER": "CONIFER", "ROSEWOOD": "ROSEWOOD" };

const MONTHLY_RATES = {
  FIME: 420, FIQE: 420, FISAE: 420, FIAE: 420,
  FIME2: 450, FIQE2: 450, FISAE2: 450, FIAE2: 450,
  NIMC: 340, NIQC: 340, NISAC: 340, NIAC: 340,
  NIMC2: 380, NIQC2: 380, NISAC2: 380, NIAC2: 380,
  FIMC: 650, FIQC: 650, FISAC: 650, FIAC: 650,
  SPOT_CASH: 0,
};

function getMultiplier(code) {
  const c = (code || "").toUpperCase();
  if (c.includes("IQE") || c.includes("IQC") || c.includes("IQR") || c === "NIQC" || c === "NIQC2") return 3;
  if (c.includes("SAE") || c.includes("SAC") || c.includes("SAR") || c === "NISAC" || c === "NISAC2") return 6;
  if (c.includes("IAE") || c.includes("IAC") || c.includes("IAR") || c === "NIAC" || c === "NIAC2") return 12;
  return 1;
}

function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s.length < 6) return null;
  const parts = s.split(/[-\/]/);
  if (parts.length === 3) {
    let [m, d, y] = parts.map(Number);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = text.split("\n").map(l => l.replace(/\r$/, ""));

  // Get current max MAF and branch
  const allMembers = await db.member.findMany({ select: { mafNo: true } });
  let nextMaf = Math.max(...allMembers.map(m => parseInt(m.mafNo) || 0)) + 1;

  // Get branch (Kidapawan)
  const branch = await db.branch.findFirst({ where: { name: { contains: "Kidapawan", mode: "insensitive" } } });
  if (!branch) { console.log("Branch not found!"); return; }
  const branchId = branch.id;

  // Cache employees
  const empCache = new Map();
  async function resolveEmployee(name, position) {
    if (!name || name.length < 3) return null;
    const key = `${name.toUpperCase()}-${position}`;
    if (empCache.has(key)) return empCache.get(key);

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const emp = await db.employee.findFirst({
      where: {
        branchId,
        firstName: { contains: firstName, mode: "insensitive" },
        lastName: { contains: lastName, mode: "insensitive" },
      },
      select: { id: true },
    });
    const id = emp?.id || null;
    empCache.set(key, id);
    return id;
  }

  let created = 0, skipped = 0;
  const errors = [];
  const results = [];

  for (let i = 2; i < lines.length; i++) {
    const vals = lines[i].split(",");
    const maf = (vals[1] || "").trim();
    const firstName = (vals[7] || "").trim();
    const lastName = (vals[9] || "").trim();
    const mopRaw = (vals[6] || "").trim().toUpperCase();
    const planRaw = (vals[4] || "").trim().toUpperCase();
    const dateRaw = (vals[2] || "").trim();
    const agentName = (vals[10] || "").trim();
    const collectorName = (vals[11] || "").trim();
    const insuranceTypeRaw = (vals[3] || "").trim();
    const middleName = (vals[8] || "").trim();
    const address = (vals[12] || "").trim();
    const dobRaw = (vals[13] || "").trim();
    const religion = (vals[15] || "").trim();
    const contact = (vals[16] || "").trim();
    const occupation = (vals[17] || "").trim();
    const civilStatus = (vals[18] || "").trim();
    const genderRaw = (vals[19] || "").trim().toUpperCase();

    // Skip rows that already have MAF numbers or no name/mop
    if (maf && /^\d+$/.test(maf)) continue;
    if (!firstName || !mopRaw) continue;

    const mopCode = MOP_MAP[mopRaw] || MOP_MAP[mopRaw.replace(/[^A-Z0-9]/g, "")] || null;
    if (!mopCode) { errors.push(`Line ${i+1}: Unknown MOP '${mopRaw}' for ${firstName} ${lastName}`); continue; }

    const planCategory = PLAN_MAP[planRaw] || "EUCALYPTUS";
    const enrollmentDate = parseDate(dateRaw) || new Date();
    const dob = parseDate(dobRaw);
    const gender = genderRaw === "MALE" ? "MALE" : genderRaw === "FEMALE" ? "FEMALE" : null;

    // Allow duplicate names — members can have multiple plans under different MAF numbers

    const agentId = await resolveEmployee(agentName, "MO");
    const collectorId = await resolveEmployee(collectorName, "AO");

    const monthlyDue = MONTHLY_RATES[mopCode] || 0;
    const multiplier = getMultiplier(mopCode);
    const totalPlan = mopCode === "SPOT_CASH" ? 0 : (multiplier > 1 ? monthlyDue * multiplier * 0.9 * (60 / multiplier) : monthlyDue * 60);

    let insuranceType = "FAMILY_INSURANCE";
    if (mopCode.startsWith("NI")) insuranceType = "NON_INSURABLE";

    const opMonth = enrollmentDate.getMonth() + 1;
    const opYear = enrollmentDate.getFullYear();

    const generatedMaf = String(nextMaf);
    nextMaf++;

    try {
      await db.member.create({
        data: {
          mafNo: generatedMaf,
          firstName,
          middleName: middleName || null,
          lastName,
          address: address || "",
          dateOfBirth: dob,
          religion: religion || null,
          contactNumber: contact || null,
          occupation: occupation || null,
          civilStatus: civilStatus || null,
          gender,
          enrollmentDate,
          effectivityDate: enrollmentDate,
          insuranceType,
          planCategory,
          mopCode,
          monthlyDue,
          totalPlanAmount: totalPlan,
          status: "ACTIVE",
          operationMonth: opMonth,
          operationYear: opYear,
          branchId,
          ...(agentId ? { agentId } : {}),
          ...(collectorId ? { collectorId } : {}),
        },
      });
      created++;
      results.push(`  MAF ${generatedMaf}: ${firstName} ${lastName} (${mopCode}, ${opMonth}/${opYear}, agent: ${agentName})`);
    } catch (err) {
      errors.push(`Line ${i+1} (${firstName} ${lastName}): ${err.message?.slice(0, 150)}`);
    }
  }

  console.log(`\n========= RESULTS =========`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exists by name): ${skipped}`);
  console.log(`Errors: ${errors.length}`);

  if (results.length > 0) {
    console.log("\nNew members:");
    results.forEach(r => console.log(r));
  }
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.slice(0, 20).forEach(e => console.log(`  ${e}`));
  }

  await db.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
