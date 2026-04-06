import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

import PaymentsTable from "@/components/payments/PaymentsTable";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string; collector?: string; page?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  const page = parseInt(searchParams.page ?? "1");
  const pageSize = 30;
  const now = new Date();

  const month = searchParams.month ? parseInt(searchParams.month) : undefined;
  const year = searchParams.year ? parseInt(searchParams.year) : undefined;

  const isAdmin = user.role === "ADMIN";
  const where: any = {};
  if (user.role === "BRANCH_STAFF") where.member = { branchId: user.branchId };
  if (month) where.periodMonth = month;
  if (year) where.periodYear = year;
  if (searchParams.collector) where.collectorId = searchParams.collector;

  const [payments, total, collectors] = await Promise.all([
    db.payment.findMany({
      where,
      include: { member: true, collector: true },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { paymentDate: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.payment.count({ where }),
    db.employee.findMany({
      where: {
        isActive: true,
        primaryPosition: "AO",
        ...(user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {}),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} records</p>
        </div>
        <Link href="/payments/new"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Record Payment
        </Link>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 shadow-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Month</label>
          <select name="month" defaultValue={searchParams.month ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Months</option>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select name="year" defaultValue={searchParams.year ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Years</option>
            {Array.from({ length: 10 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Collector</label>
          <select name="collector" defaultValue={searchParams.collector ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Collectors</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Filter
          </button>
          <Link href="/payments" className="text-sm text-gray-500 hover:text-gray-700 py-2">Clear</Link>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <PaymentsTable
          payments={payments as any[]}
          collectors={collectors.map((e) => ({ ...e, code: e.employeeNo }))}
          isAdmin={isAdmin}
        />
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/payments?page=${page - 1}`} className="px-3 py-1 border rounded hover:bg-gray-50">Previous</Link>}
              {page < totalPages && <Link href={`/payments?page=${page + 1}`} className="px-3 py-1 border rounded hover:bg-gray-50">Next</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
