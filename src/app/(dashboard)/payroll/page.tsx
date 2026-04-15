import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS } from "@/lib/utils";
import Link from "next/link";

const SALARIED_POSITIONS = ["BM", "BS", "RM", "TH", "CEO", "CHR"];

export default async function PayrollPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "HR" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [totalSalaried, withProfile, totalPayslips, draftPayslips, activeLoans, recentPayslips] = await Promise.all([
    db.employee.count({ where: { primaryPosition: { in: SALARIED_POSITIONS as any }, isActive: true } }),
    db.salaryProfile.count(),
    db.payslip.count(),
    db.payslip.count({ where: { status: "DRAFT" } }),
    db.loan.count({ where: { status: "ACTIVE" } }),
    db.payslip.findMany({
      include: {
        employee: { select: { firstName: true, lastName: true, primaryPosition: true, branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage salaries, payslips, loans, and 13th month pay</p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll/salary"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Salary Profiles
          </Link>
          <Link href="/payroll/payslips"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Generate Payslips
          </Link>
          <Link href="/payroll/loans"
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Loans
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Salaried Employees" value={totalSalaried.toString()} color="blue" />
        <StatCard label="With Salary Profile" value={withProfile.toString()} color="green" />
        <StatCard label="Total Payslips" value={totalPayslips.toString()} color="purple" />
        <StatCard label="Draft Payslips" value={draftPayslips.toString()} color="amber" />
        <StatCard label="Active Loans" value={activeLoans.toString()} color="red" />
      </div>

      {/* Recent Payslips */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Recent Payslips</h2>
          <Link href="/payroll/payslips" className="text-sm text-purple-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Employee</th>
                <th className="px-4 py-2.5 text-left">Position</th>
                <th className="px-4 py-2.5 text-left">Period</th>
                <th className="px-4 py-2.5 text-right">Gross</th>
                <th className="px-4 py-2.5 text-right">Deductions</th>
                <th className="px-4 py-2.5 text-right">Net Pay</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentPayslips.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.employee.firstName} {p.employee.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.employee.primaryPosition} · {p.employee.branch?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.cutoffLabel}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(p.grossPay))}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(Number(p.totalDeductions))}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(Number(p.netPay))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      p.status === "RELEASED" ? "bg-green-100 text-green-700" :
                      p.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {recentPayslips.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No payslips generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-l-blue-500", green: "border-l-green-500", purple: "border-l-purple-500",
    amber: "border-l-amber-500", red: "border-l-red-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${colors[color]} p-4 shadow-sm`}>
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
