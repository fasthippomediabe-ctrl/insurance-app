import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import LoanManager from "@/components/payroll/LoanManager";

const SALARIED_POSITIONS = ["BM", "BS", "RM", "TH", "CEO", "CHR"];

export default async function LoansPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const [loans, employees] = await Promise.all([
    db.loan.findMany({
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true, primaryPosition: true } },
        payments: { orderBy: { payDate: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.employee.findMany({
      where: { primaryPosition: { in: SALARIED_POSITIONS as any }, isActive: true },
      select: { id: true, firstName: true, lastName: true, primaryPosition: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <LoanManager
      loans={loans.map((l) => ({
        ...l,
        amount: Number(l.amount),
        balance: Number(l.balance),
        monthlyDeduction: Number(l.monthlyDeduction),
        startDate: l.startDate.toISOString(),
        payments: l.payments.map((p) => ({ ...p, amount: Number(p.amount), payDate: p.payDate.toISOString() })),
      }))}
      employees={employees}
    />
  );
}
