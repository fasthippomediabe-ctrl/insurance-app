import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { MONTHS } from "@/lib/utils";
import { computeAllIncentives, EmployeeData, MemberData, PaymentData } from "@/lib/incentives";
import IndividualISR from "@/components/incentives/IndividualISR";

export default async function IndividualISRPage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  const now = new Date();

  const month = searchParams.month ? parseInt(searchParams.month) : now.getMonth() + 1;
  const year = searchParams.year ? parseInt(searchParams.year) : now.getFullYear();

  const employee = await db.employee.findUnique({
    where: { id: params.employeeId },
    select: { id: true, firstName: true, lastName: true, address: true, primaryPosition: true, employeeNo: true, branchId: true, sponsorId: true,
      positions: { where: { isActive: true }, select: { position: true } },
      branch: { select: { name: true } },
    },
  });
  if (!employee) notFound();

  const branchId = employee.branchId;

  const [employees, members, payments] = await Promise.all([
    db.employee.findMany({
      where: { isActive: true, branchId },
      select: { id: true, firstName: true, lastName: true, primaryPosition: true, employeeNo: true, sponsorId: true, branchId: true, isActive: true,
        positions: { where: { isActive: true }, select: { position: true } },
      },
    }),
    db.member.findMany({
      where: { branchId, status: { not: "CANCELLED" } },
      select: { id: true, agentId: true, collectorId: true, planCategory: true, status: true, operationMonth: true, operationYear: true, monthlyDue: true, mopCode: true, effectivityDate: true, reinstatedDate: true },
    }),
    db.payment.findMany({
      where: { member: { branchId } },
      select: { id: true, memberId: true, collectorId: true, installmentNo: true, periodMonth: true, periodYear: true, amount: true, isFree: true, bcOutright: true },
    }),
  ]);

  const empData: EmployeeData[] = employees as any;
  const memData: MemberData[] = members.map((m) => ({ ...m, monthlyDue: Number(m.monthlyDue) }));
  const payData: PaymentData[] = payments.map((p) => ({ ...p, amount: Number(p.amount) }));

  const allResults = computeAllIncentives(empData, memData, payData, month, year, branchId);
  const result = allResults.find((r) => r.employeeId === params.employeeId);
  if (!result) notFound();

  return (
    <IndividualISR
      result={result}
      employee={{
        name: `${employee.firstName} ${employee.lastName}`,
        address: employee.address ?? "",
        position: employee.primaryPosition,
      }}
      branchName={employee.branch.name}
      month={month}
      year={year}
    />
  );
}
