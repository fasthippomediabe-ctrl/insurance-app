import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import AttendanceManager from "@/components/payroll/AttendanceManager";

const SALARIED_POSITIONS = ["AS", "BM", "BS", "RM", "TH", "CEO", "CHR"];

export default async function AttendancePage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      primaryPosition: { in: SALARIED_POSITIONS as any },
    },
    select: {
      id: true, employeeNo: true, firstName: true, lastName: true, primaryPosition: true,
      salaryProfile: { select: { payType: true, hoursPerDay: true } },
      branch: { select: { name: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return (
    <AttendanceManager
      employees={employees.map((e) => ({
        id: e.id,
        employeeNo: e.employeeNo,
        name: `${e.firstName} ${e.lastName}`,
        position: e.primaryPosition,
        branch: e.branch?.name ?? "",
        payType: (e.salaryProfile as any)?.payType ?? "MONTHLY",
        hoursPerDay: (e.salaryProfile as any)?.hoursPerDay ?? 8,
      }))}
    />
  );
}
