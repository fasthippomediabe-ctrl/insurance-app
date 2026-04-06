import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MONTHS } from "@/lib/utils";
import { computeAllIncentives, EmployeeData, MemberData, PaymentData } from "@/lib/incentives";
import IncentivesMasterList from "@/components/incentives/IncentivesMasterList";

export default async function IncentivesPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string; branchId?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  const now = new Date();

  const month = searchParams.month ? parseInt(searchParams.month) : now.getMonth() + 1;
  const year = searchParams.year ? parseInt(searchParams.year) : now.getFullYear();
  const branchId = searchParams.branchId ?? user.branchId;

  const [employees, members, payments, branches, branch, cutoff] = await Promise.all([
    db.employee.findMany({
      where: {
        branchId: branchId ?? undefined,
        primaryPosition: { in: ["MO", "AO", "MH", "AM", "CS", "BM"] },
      },
      select: {
        id: true, firstName: true, lastName: true, primaryPosition: true,
        employeeNo: true, sponsorId: true, branchId: true, isActive: true,
        positions: { where: { isActive: true }, select: { position: true } },
      },
      orderBy: { lastName: "asc" },
    }),
    db.member.findMany({
      where: { branchId: branchId ?? undefined, status: { not: "CANCELLED" } },
      select: {
        id: true, agentId: true, collectorId: true, planCategory: true,
        status: true, operationMonth: true, operationYear: true, monthlyDue: true, mopCode: true, effectivityDate: true, reinstatedDate: true,
      },
    }),
    db.payment.findMany({
      where: { member: { branchId: branchId ?? undefined } },
      select: {
        id: true, memberId: true, collectorId: true, installmentNo: true,
        periodMonth: true, periodYear: true, amount: true, isFree: true, bcOutright: true,
      },
    }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
    branchId ? db.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null,
    (branchId && db.operationCutoff) ? db.operationCutoff.findUnique({
      where: { branchId_month_year: { branchId, month, year } },
    }).catch(() => null) : Promise.resolve(null),
  ]);

  const empData: EmployeeData[] = employees as any;
  const memData: MemberData[] = members.map((m) => ({ ...m, monthlyDue: Number(m.monthlyDue) }));
  const payData: PaymentData[] = payments.map((p) => ({ ...p, amount: Number(p.amount) }));

  const allResults = computeAllIncentives(empData, memData, payData, month, year, branchId ?? "");
  // Only show active agents in the incentives list (inactive agents' BC goes to company, handled in computation)
  const results = allResults.filter((r) => {
    const emp = empData.find((e) => e.id === r.employeeId);
    return emp?.isActive !== false;
  });

  return (
    <IncentivesMasterList
      results={results}
      month={month}
      year={year}
      branchName={branch?.name ?? "All Branches"}
      branches={branches}
      currentBranchId={branchId ?? ""}
      isAdmin={user.role === "ADMIN"}
      cutoff={cutoff ? { ...cutoff, defaultDate: cutoff.defaultDate.toISOString(), extendedDate: cutoff.extendedDate.toISOString() } : null}
    />
  );
}
