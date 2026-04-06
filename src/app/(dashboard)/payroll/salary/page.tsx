import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SalaryManager from "@/components/payroll/SalaryManager";

const SALARIED_POSITIONS = ["BM", "BS", "RM", "TH", "CEO", "CHR"];

export default async function SalaryPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR") redirect("/dashboard");

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
        employee: { ...p.employee, branch: p.employee.branch?.name ?? "" },
      }))}
    />
  );
}
