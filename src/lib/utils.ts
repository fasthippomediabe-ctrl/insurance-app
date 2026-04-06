import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MopCode, PlanCategory, EmployeePosition } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────
// PLAN PRICING
// ─────────────────────────────────────────────

// Base monthly rate per MOP code
export const MONTHLY_RATES: Record<MopCode, number> = {
  // Eucalyptus old (P420)
  FIME: 420, FIQE: 420, FISAE: 420, FIAE: 420,
  // Eucalyptus new 2025 (P450)
  FIME2: 450, FIQE2: 450, FISAE2: 450, FIAE2: 450,
  // Cherry old (P340)
  NIMC: 340, NIQC: 340, NISAC: 340, NIAC: 340,
  // Cherry new 2025 (P380)
  NIMC2: 380, NIQC2: 380, NISAC2: 380, NIAC2: 380,
  // Conifer (P650, discontinued)
  FIMC: 650, FIQC: 650, FISAC: 650, FIAC: 650,
  // Rosewood (P1250, discontinued)
  IIMR: 1250, IIQR: 1250, IISAR: 1250, IIAR: 1250,
  SPOT_CASH: 0,
};

// Payment frequency multiplier
export function getMultiplier(mopCode: MopCode): number {
  const code = mopCode.toUpperCase();
  if (code.includes("IQE") || code.includes("IQC") || code.includes("IQR") || code === "NIQC" || code === "NIQC2" || code === "IIQR") return 3;
  if (code.includes("SAE") || code.includes("SAC") || code.includes("SAR") || code === "NISAC" || code === "NISAC2" || code === "IISAR") return 6;
  if (code.includes("IAE") || code.includes("IAC") || code.includes("IAR") || code === "NIAC" || code === "NIAC2" || code === "IIAR") return 12;
  return 1;
}

export function isDiscounted(mopCode: MopCode): boolean {
  return getMultiplier(mopCode) > 1;
}

export function getMonthlyDue(mopCode: MopCode): number {
  return MONTHLY_RATES[mopCode] ?? 0;
}

export function getPaymentAmount(mopCode: MopCode): number {
  const base = MONTHLY_RATES[mopCode] ?? 0;
  const multiplier = getMultiplier(mopCode);
  const total = base * multiplier;
  // 10% discount for quarterly, semi-annual, annual
  return multiplier > 1 ? total * 0.9 : total;
}

export function getTotalPlanAmount(mopCode: MopCode): number {
  if (mopCode === "SPOT_CASH") return 0;
  const monthly = getMonthlyDue(mopCode);
  const multiplier = getMultiplier(mopCode);
  if (multiplier > 1) {
    // Discounted: quarterly/semi-annual/annual get 10% off each payment
    // Total = paymentAmount × number of payments over 60 months
    const paymentAmount = monthly * multiplier * 0.9;
    const numPayments = 60 / multiplier;
    return paymentAmount * numPayments; // e.g. quarterly: 1215 × 20 = 24,300
  }
  return monthly * 60; // monthly: 450 × 60 = 27,000
}

export function getSpotCashAmount(mopCode: MopCode): number {
  return getTotalPlanAmount(mopCode) * 0.9; // 10% discount
}

// ─────────────────────────────────────────────
// ACTIVE ACCOUNT DEFINITIONS
// ─────────────────────────────────────────────
// Active accounts: ACTIVE + REINSTATED + FULLY_PAID (alive and covered)
// ACR accounts: ACTIVE + REINSTATED only (FULLY_PAID excluded from collection reports)
export const ACTIVE_STATUSES = ["ACTIVE", "REINSTATED", "FULLY_PAID"] as const;
export const ACR_STATUSES = ["ACTIVE", "REINSTATED"] as const;

// ─────────────────────────────────────────────
// LAPSE DETECTION — 3 consecutive unpaid months
// ─────────────────────────────────────────────
export function checkLapseStatus(
  payments: { periodYear: number; periodMonth: number }[],
  effectivityDate: Date,
  reinstatedDate?: Date | null
): boolean {
  const today = new Date();
  const paidSet = new Set(payments.map((p) => `${p.periodYear}-${p.periodMonth}`));
  // Start counting from reinstatement date if reinstated, otherwise effectivity date
  const startDate = reinstatedDate ?? effectivityDate;
  let totalUnpaid = 0;
  const cursor = new Date(startDate);
  cursor.setDate(1);
  while (cursor <= today) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
    if (!paidSet.has(key)) {
      totalUnpaid++;
      if (totalUnpaid >= 3) return true;
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return false;
}

// ─────────────────────────────────────────────
// INSTALLMENT NUMBER
// ─────────────────────────────────────────────
export function computeInstallmentNo(
  periodYear: number,
  periodMonth: number,
  effectivityDate: Date
): number {
  const startYear = effectivityDate.getFullYear();
  const startMonth = effectivityDate.getMonth() + 1;
  return (periodYear - startYear) * 12 + (periodMonth - startMonth) + 1;
}

// ─────────────────────────────────────────────
// COMMISSION — Fixed per plan, installments 1–12 only
// ─────────────────────────────────────────────
export const MAX_COMMISSION_INSTALLMENTS = 12;

// BC (Basic Commission) — fixed peso amount per paid account per month
export const BC_RATES: Record<PlanCategory, number> = {
  EUCALYPTUS: 140,
  CHERRY:     100,
  CONIFER:    180,
  ROSEWOOD:   220,
};

// TA (Travelling Allowance) — AO position only, same installment window
export const TA_RATES: Record<PlanCategory, number> = {
  EUCALYPTUS: 24,
  CHERRY:     20,
  CONIFER:    40,
  ROSEWOOD:   70,
};

export function isCommissionable(installmentNo: number): boolean {
  return installmentNo >= 1 && installmentNo <= MAX_COMMISSION_INSTALLMENTS;
}

// ─────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────
export const MOP_LABELS: Record<MopCode, string> = {
  FIME:   "Family Insurance Monthly – Eucalyptus (₱420)",
  FIQE:   "Family Insurance Quarterly – Eucalyptus (₱420)",
  FISAE:  "Family Insurance Semi-Annual – Eucalyptus (₱420)",
  FIAE:   "Family Insurance Annual – Eucalyptus (₱420)",
  FIME2:  "Family Insurance Monthly – Eucalyptus (₱450)",
  FIQE2:  "Family Insurance Quarterly – Eucalyptus (₱450)",
  FISAE2: "Family Insurance Semi-Annual – Eucalyptus (₱450)",
  FIAE2:  "Family Insurance Annual – Eucalyptus (₱450)",
  NIMC:   "Non-Insurable Monthly – Cherry (₱340)",
  NIQC:   "Non-Insurable Quarterly – Cherry (₱340)",
  NISAC:  "Non-Insurable Semi-Annual – Cherry (₱340)",
  NIAC:   "Non-Insurable Annual – Cherry (₱340)",
  NIMC2:  "Non-Insurable Monthly – Cherry (₱380)",
  NIQC2:  "Non-Insurable Quarterly – Cherry (₱380)",
  NISAC2: "Non-Insurable Semi-Annual – Cherry (₱380)",
  NIAC2:  "Non-Insurable Annual – Cherry (₱380)",
  FIMC:   "Family Insurance Monthly – Conifer (₱650) ⚠ Discontinued",
  FIQC:   "Family Insurance Quarterly – Conifer (₱650) ⚠ Discontinued",
  FISAC:  "Family Insurance Semi-Annual – Conifer (₱650) ⚠ Discontinued",
  FIAC:   "Family Insurance Annual – Conifer (₱650) ⚠ Discontinued",
  IIMR:   "Individual Insurance Monthly – Rosewood (₱1,250) ⚠ Discontinued",
  IIQR:   "Individual Insurance Quarterly – Rosewood (₱1,250) ⚠ Discontinued",
  IISAR:  "Individual Insurance Semi-Annual – Rosewood (₱1,250) ⚠ Discontinued",
  IIAR:   "Individual Insurance Annual – Rosewood (₱1,250) ⚠ Discontinued",
  SPOT_CASH: "Spot Cash (full payment, 10% discount)",
};

export const PLAN_CATEGORY_LABELS: Record<PlanCategory, string> = {
  EUCALYPTUS: "Eucalyptus",
  CHERRY: "Cherry",
  CONIFER: "Conifer (Discontinued)",
  ROSEWOOD: "Rosewood (Discontinued)",
};

export const POSITION_LABELS: Record<EmployeePosition, string> = {
  MO:  "MO – Marketing Officer / Sales Agent",
  AO:  "AO – Account Officer / Collector",
  MH:  "MH – Marketing Head",
  AM:  "AM – Area Manager",
  CS:  "CS – Collection Supervisor",
  BS:  "BS – Branch Staff",
  BM:  "BM – Branch Manager",
  RM:  "RM – Regional Manager",
  TH:  "TH – Territory Head",
  EVP: "EVP – Executive Vice President",
  CEO: "CEO – Chief Executive Officer",
  CHR: "CHR – Chairman",
};

export const COMMISSION_POSITIONS: EmployeePosition[] = ["MO", "AO", "MH", "AM", "CS"];
export const SALARIED_POSITIONS: EmployeePosition[] = ["BS", "BM", "RM", "TH", "EVP", "CEO", "CHR"];

// Production points per plan (commissionable accounts only)
export const PRODUCTION_POINTS: Record<PlanCategory, number> = {
  EUCALYPTUS: 300,
  CHERRY: 200,
  CONIFER: 400,
  ROSEWOOD: 600,
};

// Lapsed charge per account
export const LAPSED_CHARGE_PER_ACCOUNT = 5;

// Months helper
export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
