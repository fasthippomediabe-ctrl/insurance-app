import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import PayslipManager from "@/components/payroll/PayslipManager";

export default async function PayslipsPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const payslips = await db.payslip.findMany({
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeNo: true,
          primaryPosition: true, branch: { select: { name: true } },
        },
      },
    },
    orderBy: { payDate: "desc" },
    take: 100,
  });

  return (
    <PayslipManager
      payslips={payslips.map((p) => ({
        ...p,
        basicPay: Number(p.basicPay), overtime: Number(p.overtime), holidayPay: Number(p.holidayPay),
        allowances: Number(p.allowances), otherEarnings: Number(p.otherEarnings), grossPay: Number(p.grossPay),
        daysWorked: p.daysWorked, daysAbsent: Number(p.daysAbsent), lateMins: p.lateMins, lateDeduction: Number(p.lateDeduction),
        sss: Number(p.sss), philhealth: Number(p.philhealth), pagibig: Number(p.pagibig), tax: Number(p.tax),
        cashAdvance: Number(p.cashAdvance), absences: Number(p.absences), otherDeductions: Number(p.otherDeductions),
        totalDeductions: Number(p.totalDeductions), netPay: Number(p.netPay),
        periodStart: p.periodStart.toISOString(), periodEnd: p.periodEnd.toISOString(), payDate: p.payDate.toISOString(),
        employee: { ...p.employee, branch: p.employee.branch?.name ?? "" },
      }))}
    />
  );
}
