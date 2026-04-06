import { PlanCategory, EmployeePosition } from "@prisma/client";
import { BC_RATES, TA_RATES, PRODUCTION_POINTS, isCommissionable, LAPSED_CHARGE_PER_ACCOUNT } from "./utils";

// ─── Types ─────────────────────────────────────────
export interface EmployeeData {
  id: string;
  firstName: string;
  lastName: string;
  primaryPosition: EmployeePosition;
  employeeNo: string;
  sponsorId: string | null;
  branchId: string;
  positions: { position: EmployeePosition }[];
  isActive: boolean;
}

export interface MemberData {
  id: string;
  agentId: string | null;
  collectorId: string | null;
  planCategory: PlanCategory;
  status: string;
  operationMonth: number | null;
  operationYear: number | null;
  monthlyDue: number;
  mopCode: string;
  effectivityDate: Date | null;
  reinstatedDate: Date | null;
}

export interface PaymentData {
  id: string;
  memberId: string;
  collectorId: string | null;
  installmentNo: number;
  periodMonth: number;
  periodYear: number;
  amount: number;
  isFree: boolean;
  bcOutright: boolean;
}

export interface IncentiveResult {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  position: EmployeePosition;
  positions: EmployeePosition[];
  // Counts
  ne: number;           // New Enrollments (personal)
  groupNe: number;      // Group NE (downlines)
  nc: number;           // Non-Comm accounts count
  lapsableAccounts: number;
  // Production
  personalProduction: number;
  groupProduction: number;
  // Income items
  outrightCommission: number; // BC
  travellingAllowance: number;
  moIncentives: number;
  mhIncentives: number;
  amIncentives: number;
  collectorIncentives: number; // CI (COMM + NONCOMM combined)
  csIncentives: number;
  bmIncentives: number;
  // Outright (already taken during collection)
  outrightBC: number;      // BC already taken by agent (from payments where bcOutright=true)
  lumpSumBC: number;       // BC included in deposit (agent receives at end of month, 0 if deactivated)
  companyBC: number;       // BC from deactivated agents (goes to company)
  outrightTA: number;      // TA always outright (goes to collector)
  // Totals
  grossIncentives: number;
  cashBond: number;
  lapsedCharges: number;
  netIncentives: number;   // What agent actually receives at end of month
  // For grouping
  groupLabel: string; // "BM", "CS", "GROUP I", etc.
  groupOrder: number;
}

// ─── Downline helpers ──────────────────────────────
function getDirectDownlines(employeeId: string, employees: EmployeeData[]): EmployeeData[] {
  return employees.filter((e) => e.sponsorId === employeeId);
}

function getAllDownlines(employeeId: string, employees: EmployeeData[]): EmployeeData[] {
  const result: EmployeeData[] = [];
  const queue = getDirectDownlines(employeeId, employees);
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    queue.push(...getDirectDownlines(current.id, employees));
  }
  return result;
}

// ─── MO Personal PI ────────────────────────────────
// 5% of personal production (all levels), 8% if >= 10,000
function computeMoPI(personalProduction: number): number {
  if (personalProduction <= 0) return 0;
  if (personalProduction >= 10000) return personalProduction * 0.08;
  return personalProduction * 0.05;
}

// ─── MH Incentives ─────────────────────────────────
function computeMhGroupPIRate(totalGroupNe: number): number {
  if (totalGroupNe >= 21) return 0.10;
  if (totalGroupNe >= 20) return 0.08;
  return 0.05;
}

function computeMhAllowance(totalGroupNe: number): number {
  if (totalGroupNe >= 51) return 2000;
  if (totalGroupNe >= 41) return 1500;
  if (totalGroupNe >= 31) return 1000;
  if (totalGroupNe >= 21) return 500;
  return 0;
}

// ─── AM Incentives ─────────────────────────────────
function computeAmGroupPIRate(totalNetworkNe: number): number {
  if (totalNetworkNe >= 60) return 0.03;
  return 0.015;
}

function computeAmAllowance(totalNetworkNe: number): number {
  if (totalNetworkNe >= 60) return 5000;
  if (totalNetworkNe >= 30) return 2000;
  return 0;
}

// ─── AO Matrix Lookup ──────────────────────────────
const COMM_MATRIX: [number, number, number, number][] = [
  // [tcpMin, dap60_80, dap81_90, dap91_100]
  [65, 0.05, 0.055, 0.06],
  [66, 0.055, 0.06, 0.065],
  [71, 0.06, 0.065, 0.07],
  [76, 0.065, 0.07, 0.075],
  [81, 0.07, 0.075, 0.08],
  [86, 0.075, 0.08, 0.085],
  [91, 0.08, 0.085, 0.09],
  [96, 0.085, 0.09, 0.095],
  [101, 0.09, 0.095, 0.10],
  [106, 0.095, 0.10, 0.105],
  [111, 0.10, 0.105, 0.11],
];

const NONCOMM_MATRIX: [number, number, number, number][] = [
  [75, 0.06, 0.065, 0.07],
  [81, 0.065, 0.07, 0.075],
  [86, 0.07, 0.075, 0.08],
  [91, 0.075, 0.08, 0.085],
  [96, 0.08, 0.085, 0.09],
  [101, 0.085, 0.09, 0.095],
  [106, 0.09, 0.095, 0.10],
  [111, 0.095, 0.10, 0.105],
  [116, 0.10, 0.105, 0.11],
];

function lookupMatrix(matrix: [number, number, number, number][], tcp: number, dap: number): number {
  // Find the row: last row where tcpMin <= tcp
  let row = matrix[0];
  for (const r of matrix) {
    if (tcp >= r[0]) row = r;
    else break;
  }
  // DAP column: 60-80% = col1, 81-90% = col2, 91-100% = col3
  if (dap >= 91) return row[3];
  if (dap >= 81) return row[2];
  return row[1];
}

function computeAOIncentives(
  collectorId: string,
  members: MemberData[],
  payments: PaymentData[],
  month: number,
  year: number
): { ci: number } {
  const myMembers = members.filter((m) => m.collectorId === collectorId);
  const monthPayments = payments.filter((p) => p.periodMonth === month && p.periodYear === year);

  // Split into COMM (installments 1-12) and NONCOMM (13+)
  let commDue = 0, commPaid = 0, commCollection = 0, commProduction = 0;
  let ncDue = 0, ncPaid = 0, ncCollection = 0, ncProduction = 0;

  for (const m of myMembers) {
    if (m.status === "CANCELLED" || m.status === "DECEASED_CLAIMANT") continue;
    const allPaid = payments.filter((p) => p.memberId === m.id && !p.isFree);
    const maxInst = allPaid.length > 0 ? Math.max(...allPaid.map((p) => p.installmentNo)) : 0;
    const nextInst = maxInst + 1;
    const monthPaid = monthPayments.find((p) => p.memberId === m.id && !p.isFree);

    if (isCommissionable(nextInst)) {
      commDue++;
      if (monthPaid) { commPaid++; commCollection += Number(monthPaid.amount); commProduction += PRODUCTION_POINTS[m.planCategory]; }
    } else {
      ncDue++;
      if (monthPaid) { ncPaid++; ncCollection += Number(monthPaid.amount); ncProduction += PRODUCTION_POINTS[m.planCategory]; }
    }
  }

  // COMM: DAP >= 60%, TCP >= 65%
  const commDAP = commDue > 0 ? (commPaid / commDue) * 100 : 0;
  const commExpected = commDue > 0 ? myMembers.filter((m) => {
    const ap = payments.filter((p) => p.memberId === m.id && !p.isFree);
    const ni = ap.length > 0 ? Math.max(...ap.map((p) => p.installmentNo)) + 1 : 1;
    return isCommissionable(ni);
  }).reduce((s, m) => s + m.monthlyDue, 0) : 0;
  const commTCP = commExpected > 0 ? (commCollection / commExpected) * 100 : 0;
  const commPass = commDAP >= 60 && commTCP >= 65;

  // NONCOMM: DAP >= 70%, TCP >= 75%
  const ncDAP = ncDue > 0 ? (ncPaid / ncDue) * 100 : 0;
  const ncExpected = ncDue > 0 ? myMembers.filter((m) => {
    const ap = payments.filter((p) => p.memberId === m.id && !p.isFree);
    const ni = ap.length > 0 ? Math.max(...ap.map((p) => p.installmentNo)) + 1 : 1;
    return !isCommissionable(ni);
  }).reduce((s, m) => s + m.monthlyDue, 0) : 0;
  const ncTCP = ncExpected > 0 ? (ncCollection / ncExpected) * 100 : 0;
  const ncPass = ncDAP >= 70 && ncTCP >= 75;

  // Lookup rates from matrices
  let commInc = 0, ncInc = 0;
  if (commPass) commInc = commProduction * lookupMatrix(COMM_MATRIX, commTCP, commDAP);
  if (ncPass) ncInc = ncProduction * lookupMatrix(NONCOMM_MATRIX, ncTCP, ncDAP);

  // Pass/fail multiplier
  let ci = commInc + ncInc;
  if (commPass && ncPass) { /* 100% */ }
  else if (commPass || ncPass) { ci *= 0.5; }
  else { ci = 0; }

  return { ci };
}

// ─── CS Incentives (COMM + NONCOMM) ────────────────
const CS_COMM_MATRIX: { minTcp: number; rates: [number, number, number] }[] = [
  { minTcp: 65, rates: [0.01, 0.01, 0.015] },
  { minTcp: 81, rates: [0.01, 0.015, 0.02] },
  { minTcp: 100, rates: [0.015, 0.02, 0.02] },
  { minTcp: 116, rates: [0.02, 0.02, 0.03] },
];

const CS_NONCOMM_MATRIX: { minTcp: number; rates: [number, number, number] }[] = [
  { minTcp: 75, rates: [0.015, 0.0175, 0.02] },
  { minTcp: 100, rates: [0.0175, 0.02, 0.0225] },
  { minTcp: 116, rates: [0.02, 0.0225, 0.025] },
];

function lookupCSMatrix(matrix: { minTcp: number; rates: [number, number, number] }[], tcp: number, accountCount: number): number {
  let row = matrix[0];
  for (const r of matrix) {
    if (tcp >= r.minTcp) row = r;
    else break;
  }
  if (!row) return 0;
  if (accountCount > 2000) return row.rates[2];
  if (accountCount > 1000) return row.rates[1];
  return row.rates[0];
}

// ─── Main computation ──────────────────────────────
export function computeAllIncentives(
  employees: EmployeeData[],
  members: MemberData[],
  payments: PaymentData[],
  month: number,
  year: number,
  branchId: string
): IncentiveResult[] {
  const results: IncentiveResult[] = [];
  const branchMembers = members; // already filtered by branch
  const monthPayments = payments.filter((p) => p.periodMonth === month && p.periodYear === year);

  // Pre-compute member payment history for "first payment = no TA"
  const memberPaidCountBefore = new Map<string, number>();
  for (const p of payments) {
    if (p.isFree) continue;
    if (p.periodYear < year || (p.periodYear === year && p.periodMonth < month)) {
      memberPaidCountBefore.set(p.memberId, (memberPaidCountBefore.get(p.memberId) ?? 0) + 1);
    }
  }

  // Group assignment for the master list
  // Find AM groups by looking at the sponsor chain
  let groupCounter = 0;

  for (const emp of employees) {
    const allPositions = [emp.primaryPosition, ...emp.positions.map((p) => p.position)];
    const uniquePositions = [...new Set(allPositions)];

    // ── NE (New Enrollments) ──
    const isBM = uniquePositions.includes("BM");
    const isCS = uniquePositions.includes("CS");
    const ne = branchMembers.filter(
      (m) => m.agentId === emp.id && m.operationMonth === month && m.operationYear === year
    ).length;

    // ── Personal Production ──
    // Count per INSTALLMENT, not per member. Quarterly member paying 3 commissionable
    // installments = 3x production points. Spot cash = 12 comm installments.
    let personalProduction = 0;
    const agentMembers = branchMembers.filter((m) => m.agentId === emp.id);
    for (const m of agentMembers) {
      const paidComm = monthPayments.filter(
        (p) => p.memberId === m.id && !p.isFree && isCommissionable(p.installmentNo)
      );
      personalProduction += paidComm.length * PRODUCTION_POINTS[m.planCategory];
    }

    // ── Basic Commission (BC) — split by outright vs lump sum ──
    let outrightCommission = 0; // total BC for this agent's accounts
    let outrightBC = 0;         // BC taken outright during collection
    let lumpSumBC = 0;          // BC deposited, agent gets at end of month
    let companyBC = 0;          // BC from deactivated agent → goes to company
    for (const m of agentMembers) {
      const paid = monthPayments.filter(
        (p) => p.memberId === m.id && !p.isFree && isCommissionable(p.installmentNo)
      );
      for (const p of paid) {
        const bc = BC_RATES[m.planCategory];
        outrightCommission += bc;
        if (p.bcOutright) {
          // Agent took BC during collection
          outrightBC += bc;
        } else if (!emp.isActive) {
          // Agent deactivated — BC goes to company
          companyBC += bc;
        } else {
          // Agent active but didn't take BC — gets it at end of month
          lumpSumBC += bc;
        }
      }
    }

    // ── Travelling Allowance (AO collectors ONLY) ──
    // TA goes to the person who COLLECTED the payment, not the agent who enrolled.
    // Rule: first-ever paid payment for a member = no TA. All subsequent = TA.
    // Spot cash members = NO TA (no recurring collection).
    let travellingAllowance = 0;
    if (uniquePositions.includes("AO") && !isBM && !isCS) {
      const collectorMembers = branchMembers.filter((m) => m.collectorId === emp.id);
      for (const m of collectorMembers) {
        if (m.mopCode === "SPOT_CASH") continue; // No TA for spot cash
        const paidBefore = memberPaidCountBefore.get(m.id) ?? 0;
        const paidThisMonth = monthPayments.filter((p) => p.memberId === m.id && !p.isFree).length;
        if (paidThisMonth === 0) continue;
        const taCount = paidBefore > 0 ? paidThisMonth : Math.max(0, paidThisMonth - 1);
        travellingAllowance += taCount * TA_RATES[m.planCategory];
      }
    }

    // ── Downlines ──
    const allDownlines = getAllDownlines(emp.id, employees);
    const allDownlineIds = new Set(allDownlines.map((d) => d.id));

    // ── Group NE (position-dependent) ──
    // MO: no group NE
    // MH: NE from direct downlines (their recruited MOs)
    // AM: NE from entire network (all downlines)
    // BM/CS: total branch NE
    let groupNe = 0;
    const totalBranchNe = branchMembers.filter(
      (m) => m.operationMonth === month && m.operationYear === year
    ).length;

    if (uniquePositions.includes("BM")) {
      groupNe = totalBranchNe;
    } else if (uniquePositions.includes("AM")) {
      groupNe = branchMembers.filter(
        (m) => m.agentId && allDownlineIds.has(m.agentId) && m.operationMonth === month && m.operationYear === year
      ).length;
    } else if (uniquePositions.includes("MH")) {
      const directDownlineIds = new Set(getDirectDownlines(emp.id, employees).map((d) => d.id));
      groupNe = branchMembers.filter(
        (m) => m.agentId && directDownlineIds.has(m.agentId) && m.operationMonth === month && m.operationYear === year
      ).length;
    }

    // ── Group Production (personal + downlines) ──
    // MO: no group production
    // MH: personal + MOs under them
    // AM: personal + entire network
    // BM: total branch production
    let groupProduction = 0;
    const downlineIdsForProd = uniquePositions.includes("BM")
      ? new Set(employees.filter((e) => e.id !== emp.id).map((e) => e.id))
      : uniquePositions.includes("AM")
      ? allDownlineIds
      : uniquePositions.includes("MH")
      ? new Set(getDirectDownlines(emp.id, employees).map((d) => d.id))
      : new Set<string>();

    for (const dlId of downlineIdsForProd) {
      const dlMembers = branchMembers.filter((m) => m.agentId === dlId);
      for (const m of dlMembers) {
        const paidComm = monthPayments.filter(
          (p) => p.memberId === m.id && !p.isFree && isCommissionable(p.installmentNo)
        );
        groupProduction += paidComm.length * PRODUCTION_POINTS[m.planCategory];
      }
    }
    // Group production includes personal for MH/AM/BM
    if (uniquePositions.includes("MH") || uniquePositions.includes("AM") || isBM) {
      groupProduction += personalProduction;
    }

    // ── Position-based Incentives ──
    // BM only gets BM incentives, CS only gets CS incentives.
    // Lower positions only earn their highest applicable incentive tier.
    let moIncentives = 0;
    let mhIncentives = 0;
    let amIncentives = 0;

    if (isBM) {
      // BM: only BM incentives (computed below), no MO/MH/AM
    } else if (isCS) {
      // CS: only CS incentives (computed below), no MO/MH/AM
    } else {
      // MO Incentives (Personal PI)
      if (uniquePositions.includes("MO")) {
        moIncentives = computeMoPI(personalProduction);
      }

      // MH Incentives
      if (uniquePositions.includes("MH")) {
        const totalGroupNe = ne + groupNe;
        const rate = computeMhGroupPIRate(totalGroupNe);
        const groupPI = groupProduction * rate;
        const allowance = computeMhAllowance(totalGroupNe);
        mhIncentives = groupPI + allowance;
      }

      // AM Incentives
      if (uniquePositions.includes("AM")) {
        const totalNetworkNe = ne + groupNe;
        const rate = computeAmGroupPIRate(totalNetworkNe);
        const networkPI = (personalProduction + groupProduction) * rate;
        const allowance = computeAmAllowance(totalNetworkNe);
        amIncentives = networkPI + allowance;
      }
    }

    // ── AO Incentives (commissionable accounts only) ──
    // BM and CS don't get AO incentives even if they hold AO position
    let collectorIncentives = 0;
    if (uniquePositions.includes("AO") && !isBM && !isCS) {
      const ao = computeAOIncentives(emp.id, branchMembers, payments, month, year);
      collectorIncentives = ao.ci;
    }

    // ── CS Incentives (COMM + NONCOMM, branch-level) ──
    let csIncentives = 0;
    if (uniquePositions.includes("CS")) {
      const activeMembers = branchMembers.filter((m) => m.status !== "CANCELLED" && m.status !== "DECEASED_CLAIMANT");
      const totalAccounts = activeMembers.length;

      // Split into COMM and NONCOMM
      const commMembers = activeMembers.filter((m) => {
        const mp = payments.filter((p) => p.memberId === m.id && !p.isFree);
        const ni = mp.length > 0 ? Math.max(...mp.map((p) => p.installmentNo)) + 1 : 1;
        return isCommissionable(ni);
      });
      const ncMembers = activeMembers.filter((m) => {
        const mp = payments.filter((p) => p.memberId === m.id && !p.isFree);
        const ni = mp.length > 0 ? Math.max(...mp.map((p) => p.installmentNo)) + 1 : 1;
        return !isCommissionable(ni);
      });

      // COMM
      const commPaid = commMembers.filter((m) => monthPayments.some((p) => p.memberId === m.id && !p.isFree));
      const commTCP = commMembers.length > 0 ? (commPaid.length / commMembers.length) * 100 : 0;
      const commCollection = commPaid.reduce((s, m) => {
        const p = monthPayments.find((p) => p.memberId === m.id && !p.isFree);
        return s + (p ? Number(p.amount) : 0);
      }, 0);
      if (commTCP >= 65) {
        csIncentives += commCollection * lookupCSMatrix(CS_COMM_MATRIX, commTCP, totalAccounts);
      }

      // NONCOMM
      const ncPaid = ncMembers.filter((m) => monthPayments.some((p) => p.memberId === m.id && !p.isFree));
      const ncTCP = ncMembers.length > 0 ? (ncPaid.length / ncMembers.length) * 100 : 0;
      const ncCollection = ncPaid.reduce((s, m) => {
        const p = monthPayments.find((p) => p.memberId === m.id && !p.isFree);
        return s + (p ? Number(p.amount) : 0);
      }, 0);
      if (ncTCP >= 75) {
        csIncentives += ncCollection * lookupCSMatrix(CS_NONCOMM_MATRIX, ncTCP, totalAccounts);
      }
    }

    // ── BM Incentives ──
    let bmIncentives = 0;
    if (uniquePositions.includes("BM")) {
      // Based on total branch NE and total branch COMM production points
      // Count per installment (quarterly = 3x, spot cash = 12x for comm)
      let totalBranchProduction = 0;
      for (const m of branchMembers) {
        const paidComm = monthPayments.filter(
          (p) => p.memberId === m.id && !p.isFree && isCommissionable(p.installmentNo)
        );
        totalBranchProduction += paidComm.length * PRODUCTION_POINTS[m.planCategory];
      }

      if (totalBranchNe >= 100 && totalBranchProduction >= 200000) {
        bmIncentives = totalBranchProduction * 0.03 + 5000;
      } else if (totalBranchNe >= 100 && totalBranchProduction < 200000) {
        bmIncentives = totalBranchProduction * 0.015 + 5000;
      } else if (totalBranchNe <= 99 && totalBranchProduction >= 200000) {
        bmIncentives = totalBranchProduction * 0.03;
      } else {
        bmIncentives = totalBranchProduction * 0.015;
      }
    }

    const nc = 0; // Not used — ISR only covers commissionable accounts

    // ── Lapsable Accounts (charged to COLLECTOR, not agent) ──
    // Count TOTAL unpaid months (cumulative, not consecutive) from enrollment/reinstatement.
    // If total unpaid ≥ 3 AND not paid this month → lapsed.
    // BM and CS are not charged lapsed — only AO collectors.
    let lapsableAccounts = 0;
    if (uniquePositions.includes("AO") && !isBM && !isCS) {
      const collectorMembers = branchMembers.filter((m) => m.collectorId === emp.id);
      for (const cm of collectorMembers) {
        if (cm.status !== "ACTIVE" && cm.status !== "REINSTATED") continue;

        const startDate = cm.reinstatedDate ?? cm.effectivityDate;
        if (!startDate) continue;

        const paidSet = new Set(
          payments.filter((p) => p.memberId === cm.id && !p.isFree).map((p) => `${p.periodYear}-${p.periodMonth}`)
        );

        // Count total unpaid months from start to current month
        let totalUnpaid = 0;
        const cursor = new Date(startDate);
        cursor.setDate(1);
        const endDate = new Date(year, month - 1, 1); // current operation month
        while (cursor <= endDate) {
          const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
          if (!paidSet.has(key)) {
            totalUnpaid++;
          }
          cursor.setMonth(cursor.getMonth() + 1);
        }

        // If 3+ total unpaid months AND not paid this month → lapsable
        const paidThisMonth = monthPayments.some((p) => p.memberId === cm.id && !p.isFree);
        if (totalUnpaid >= 3 && !paidThisMonth) {
          lapsableAccounts++;
        }
      }
    }

    // ── Outright amounts (already taken during collection) ──
    // TA is ALWAYS outright (goes to collector, not agent)
    const outrightTA = travellingAllowance;

    // ── Totals ──
    const lapsedCharges = lapsableAccounts * LAPSED_CHARGE_PER_ACCOUNT;
    const grossIncentives = outrightCommission + travellingAllowance + moIncentives +
      mhIncentives + amIncentives + collectorIncentives +
      csIncentives + bmIncentives;

    // ── Cash Bond: ₱200 if incentives portion > ₱2,000 ──
    // Based on incentives only (MO+MH+AM+CI+CSI+BM PI), NOT including BC/TA which are outright
    const incentivesOnly = moIncentives + mhIncentives + amIncentives +
      collectorIncentives + csIncentives + bmIncentives;
    const cashBond = incentivesOnly > 2000 ? 200 : 0;

    // Net = gross - outrightBC (already taken) - outrightTA (goes to collector)
    //        - companyBC (deactivated agent, goes to company) - cashBond - lapsedCharges
    // lumpSumBC stays in net (agent receives it at end of month)
    const netIncentives = grossIncentives - outrightBC - outrightTA - companyBC - cashBond - lapsedCharges;

    // ── Group label for display ──
    let groupLabel = "";
    let groupOrder = 50;
    if (emp.primaryPosition === "BM") { groupLabel = "BM"; groupOrder = 1; }
    else if (emp.primaryPosition === "CS") { groupLabel = "CS"; groupOrder = 2; }
    else if (emp.primaryPosition === "AM") { groupOrder = 10; }
    else if (emp.primaryPosition === "MH") { groupOrder = 20; }
    else if (emp.primaryPosition === "MO") { groupOrder = 30; }
    else { groupOrder = 40; }

    results.push({
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeNo: emp.employeeNo,
      position: emp.primaryPosition,
      positions: uniquePositions,
      ne,
      groupNe,
      nc,
      lapsableAccounts,
      personalProduction,
      groupProduction,
      outrightCommission,
      travellingAllowance,
      moIncentives,
      mhIncentives,
      amIncentives,
      collectorIncentives,
      outrightBC,
      lumpSumBC,
      companyBC,
      outrightTA,
      csIncentives,
      bmIncentives,
      grossIncentives,
      cashBond,
      lapsedCharges,
      netIncentives,
      groupLabel,
      groupOrder,
    });
  }

  // Sort: BM first, CS second, then by group (AM→MH→MO)
  results.sort((a, b) => a.groupOrder - b.groupOrder || a.employeeName.localeCompare(b.employeeName));

  return results;
}
