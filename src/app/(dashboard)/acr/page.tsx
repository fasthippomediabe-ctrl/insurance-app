import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeInstallmentNo, getPaymentAmount, MONTHS } from "@/lib/utils";
import { MopCode, PlanCategory } from "@prisma/client";
import AcrFilterBar from "@/components/acr/AcrFilterBar";
import AcrPrintView from "@/components/acr/AcrPrintView";

// Get MOP payment interval in months
function getMopInterval(mopCode: string): number {
  if (mopCode === "SPOT_CASH") return 0;
  // 3rd char: M=monthly(1), Q=quarterly(3), A=annual(12)
  // Special: SA in code = semi-annual(6)
  if (mopCode.includes("SA")) return 6;
  const third = mopCode.length >= 3 ? mopCode[2] : "M";
  if (third === "Q") return 3;
  if (third === "A") return 12;
  return 1; // monthly
}

// Compute due date = last paid period + interval
// If no payments: effectivity date + interval (or + 2*interval if FREE)
function computeDueDate(
  effDate: Date,
  payments: { periodYear: number; periodMonth: number; isFree?: boolean }[],
  mopCode: string
): Date {
  const interval = getMopInterval(mopCode);
  if (interval === 0) return effDate;

  const paidPayments = payments.filter((p) => !p.isFree);
  const due = new Date(effDate);

  if (paidPayments.length > 0) {
    // Find the latest paid period
    const latest = paidPayments.reduce((best, p) =>
      (p.periodYear > best.periodYear || (p.periodYear === best.periodYear && p.periodMonth > best.periodMonth)) ? p : best
    );
    due.setFullYear(latest.periodYear);
    due.setMonth(latest.periodMonth - 1); // set to last paid month
    due.setMonth(due.getMonth() + interval); // add interval for next due
  } else {
    // No paid payments — check if has FREE
    const hasFree = payments.some((p) => p.isFree);
    if (hasFree) {
      // FREE covers 1st period, so due = effectivity + 2 intervals
      due.setMonth(due.getMonth() + 2 * interval);
    } else {
      // No payments at all — due = effectivity + interval
      due.setMonth(due.getMonth() + interval);
    }
  }
  return due;
}

// Compute aging based on due date vs ACR month
// Returns 0 (current), 30, 60, 90, or 120 (lapsed — should be excluded from ACR)
function computeAging(dueDate: Date, currentYear: number, currentMonth: number): 0 | 30 | 60 | 90 | 120 {
  const dueY = dueDate.getFullYear();
  const dueM = dueDate.getMonth() + 1;

  // Months overdue = current period - due period
  const monthsOverdue = (currentYear - dueY) * 12 + (currentMonth - dueM);

  if (monthsOverdue <= 0) return 0;   // not yet due or due this month
  if (monthsOverdue === 1) return 30;
  if (monthsOverdue === 2) return 60;
  if (monthsOverdue === 3) return 90;
  return 120; // 4+ months = lapsed
}

export interface AcrRow {
  mafNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  effectivityDate: string;
  dueDate: string;
  mopCode: string;
  comAmount: number;
  ncomAmount: number;
  installmentNo: number;
  aging: 0 | 30 | 60 | 90 | 120;
  balance: number;
  address: string;
  contactNumber: string;
  agentName: string;
}

export default async function AcrPage({
  searchParams,
}: {
  searchParams: { collectorId?: string; month?: string; year?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  const today = new Date();
  const currentMonth = parseInt(searchParams.month ?? "") || today.getMonth() + 1;
  const currentYear = parseInt(searchParams.year ?? "") || today.getFullYear();
  const collectorId = searchParams.collectorId ?? "";

  // Get all employees who have members assigned as collector (not just AO position)
  const distinctCollectorIds = await db.member.findMany({
    where: {
      collectorId: { not: null },
      status: { in: ["ACTIVE", "REINSTATED"] },
    },
    select: { collectorId: true },
    distinct: ["collectorId"],
  });
  const collectorIdList = distinctCollectorIds
    .map((m) => m.collectorId)
    .filter((id): id is string => id !== null);

  const collectors = await db.employee.findMany({
    where: {
      id: { in: collectorIdList },
      isActive: true,
      ...(user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {}),
    },
    select: { id: true, firstName: true, lastName: true, employeeNo: true, branch: { select: { name: true } } },
    orderBy: { lastName: "asc" },
  });

  let collector: { firstName: string; lastName: string; employeeNo: string; branch: { name: string } } | null = null;
  let commRows: AcrRow[] = [];
  let nonCommRows: AcrRow[] = [];

  if (collectorId) {
    collector = await db.employee.findUnique({
      where: { id: collectorId },
      select: { firstName: true, lastName: true, employeeNo: true, branch: { select: { name: true } } },
    });

    const members = await db.member.findMany({
      where: {
        collectorId,
        status: { in: ["ACTIVE", "REINSTATED"] },
        spotCash: false,
        mopCode: { not: "SPOT_CASH" },
        // Exclude new sales enrolled THIS month (they go into next month's ACR)
        // Members with null operationMonth are included (legacy data)
        OR: [
          { operationMonth: { not: currentMonth } },
          { operationYear: { not: currentYear } },
          { operationMonth: null },
        ],
      },
      include: {
        payments: { select: { periodYear: true, periodMonth: true, amount: true, isFree: true } },
        agent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { lastName: "asc" },
    });

    for (const m of members) {
      const effDate = m.effectivityDate ?? m.enrollmentDate;
      if (!effDate) continue;
      const instNo = computeInstallmentNo(currentYear, currentMonth, effDate);
      if (instNo < 1) continue;

      const dueDate = computeDueDate(effDate, m.payments, m.mopCode);
      const aging = computeAging(dueDate, currentYear, currentMonth);

      // 120 days overdue = lapsed, exclude from ACR
      if (aging === 120) continue;

      const totalPaid = m.payments.reduce((s, p) => s + Number(p.amount), 0);
      const balance = Math.max(0, Number(m.totalPlanAmount) - totalPaid);
      const paymentAmount = getPaymentAmount(m.mopCode as MopCode);

      // Overdue amount based on aging
      let overdueAmount = 0;
      if (aging > 0) {
        const agingMonths = aging / 30; // 1, 2, or 3
        const interval = getMopInterval(m.mopCode);
        if (interval <= 1) {
          // Monthly: each overdue month = 1 payment (e.g., 60 days = 2 × ₱420 = ₱840)
          overdueAmount = agingMonths * paymentAmount;
        } else {
          // Quarterly/SA/Annual: count missed payment periods
          overdueAmount = Math.ceil(agingMonths / interval) * paymentAmount;
        }
      }

      const isComm = instNo <= 12;
      const fmtD = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getFullYear()).slice(2)}`;

      const row: AcrRow = {
        mafNo: m.mafNo,
        firstName: m.firstName,
        middleName: m.middleName ?? "",
        lastName: m.lastName,
        effectivityDate: fmtD(effDate),
        dueDate: fmtD(dueDate),
        mopCode: m.mopCode,
        comAmount: isComm ? overdueAmount : 0,
        ncomAmount: isComm ? 0 : overdueAmount,
        installmentNo: instNo,
        aging,
        balance,
        address: m.address,
        contactNumber: m.contactNumber ?? "",
        agentName: m.agent ? `${m.agent.firstName} ${m.agent.lastName}` : "",
      };

      if (isComm) commRows.push(row);
      else nonCommRows.push(row);
    }
  }

  const periodLabel = `${MONTHS[currentMonth - 1]} ${currentYear}`;
  const collectorName = collector ? `${collector.firstName} ${collector.lastName}` : "";
  const branchName = collector?.branch?.name ?? "";

  return (
    <div>
      {/* Screen filter bar — hidden on print */}
      <div className="print:hidden mb-5">
        <AcrFilterBar
          collectors={collectors.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName} (${c.employeeNo})`,
          }))}
          currentCollectorId={collectorId}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      </div>

      {collector && (
        <AcrPrintView
          commRows={commRows}
          nonCommRows={nonCommRows}
          collectorName={collectorName}
          branchName={branchName}
          month={currentMonth}
          year={currentYear}
          periodLabel={periodLabel}
        />
      )}

      {!collector && !collectorId && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          Select a collector and click Generate to view the ACR.
        </div>
      )}
    </div>
  );
}
