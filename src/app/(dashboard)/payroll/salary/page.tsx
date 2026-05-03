import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SalaryManager from "@/components/payroll/SalaryManager";

const SALARIED_POSITIONS = ["AS", "BM", "BS", "RM", "TH", "CEO", "CHR"];

export default async function SalaryPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const [employees, profiles] = await Promise.all([
    db.employee.findMany({
      where: { primaryPosition: { in: SALARIED_POSITIONS as any }, isActive: true },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, primaryPosition: true, branch: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
    db.salaryProfile.findMany({
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNo: true, primaryPosition: true, branch: { select: { name: true } } },
        },
      },
    }),
  ]);

  return (
    <SalaryManager
      employees={employees.map((e) => ({ ...e, branch: e.branch?.name ?? "" }))}
      profiles={profiles.map((p) => ({
        ...p,
        basicSalary: Number(p.basicSalary),
        riceAllowance: Number(p.riceAllowance),
        transpoAllowance: Number(p.transpoAllowance),
        otherAllowance: Number(p.otherAllowance),
        sssContribution: Number(p.sssContribution),
        philhealthContribution: Number(p.philhealthContribution),
        pagibigContribution: Number(p.pagibigContribution),
        withholdingTax: Number(p.withholdingTax),
        lateGraceMins: p.lateGraceMins,
        lateRatePerHour: Number(p.lateRatePerHour),
        dailyRate: Number(p.dailyRate),
        payType: (p as any).payType ?? "MONTHLY",
        hoursPerDay: (p as any).hoursPerDay ?? 8,
        overtimeRate: Number((p as any).overtimeRate ?? 0),
        workingDaysPerCutoff: (p as any).workingDaysPerCutoff ?? 11,
        employee: { ...p.employee, branch: p.employee.branch?.name ?? "" },
      }))}
    />
  );
}
