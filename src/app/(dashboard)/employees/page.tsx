import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatDate, POSITION_LABELS, COMMISSION_POSITIONS } from "@/lib/utils";
import { EmployeePosition } from "@prisma/client";

const BRANCH_POSITIONS: EmployeePosition[] = ["MO", "AO", "MH", "AM", "BS", "BM"];

const POSITION_COLORS: Record<string, string> = {
  MO:  "bg-blue-100 text-blue-700",
  AO:  "bg-teal-100 text-teal-700",
  MH:  "bg-purple-100 text-purple-700",
  AM:  "bg-indigo-100 text-indigo-700",
  BS:  "bg-gray-100 text-gray-600",
  BM:  "bg-green-100 text-green-700",
  RM:  "bg-orange-100 text-orange-700",
  TH:  "bg-red-100 text-red-700",
  EVP: "bg-yellow-100 text-yellow-700",
  CEO: "bg-pink-100 text-pink-700",
  CHR: "bg-rose-100 text-rose-800",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { position?: string; search?: string; branch?: string; status?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  const where: any = {};
  if (user.role === "BRANCH_STAFF") {
    where.branchId = user.branchId;
    where.primaryPosition = { in: BRANCH_POSITIONS };
  }
  if (searchParams.position) where.primaryPosition = searchParams.position as EmployeePosition;
  if (searchParams.branch && user.role === "ADMIN") where.branchId = searchParams.branch;
  if (searchParams.status === "active") where.isActive = true;
  else if (searchParams.status === "inactive") where.isActive = false;
  // Default: show active only (unless explicitly filtered)
  else if (!searchParams.status) where.isActive = true;
  if (searchParams.search) {
    where.OR = [
      { firstName: { contains: searchParams.search, mode: "insensitive" } },
      { lastName: { contains: searchParams.search, mode: "insensitive" } },
      { employeeNo: { contains: searchParams.search, mode: "insensitive" } },
    ];
  }

  const [employees, branches] = await Promise.all([
    db.employee.findMany({
      where,
      include: {
        branch: true,
        sponsor: true,
        positions: { where: { isActive: true }, orderBy: { dateGranted: "asc" } },
      },
      orderBy: [{ primaryPosition: "asc" }, { lastName: "asc" }],
    }),
    user.role === "ADMIN" ? db.branch.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-0.5">{employees.length} team members</p>
        </div>
        <Link href="/employees/new"
          className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm"
          style={{ background: "#1535b0" }}>
          + Add Employee
        </Link>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 shadow-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input name="search" defaultValue={searchParams.search}
            placeholder="Name or employee no..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Position</label>
          <select name="position" defaultValue={searchParams.position ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Positions</option>
            {Object.entries(POSITION_LABELS)
              .filter(([k]) => user.role === "ADMIN" || BRANCH_POSITIONS.includes(k as EmployeePosition))
              .map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
          </select>
        </div>
        {user.role === "ADMIN" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Branch</label>
            <select name="branch" defaultValue={searchParams.branch ?? ""}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select name="status" defaultValue={searchParams.status ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="text-white text-sm font-medium px-4 py-2 rounded-lg"
            style={{ background: "#1535b0" }}>Search</button>
          <Link href="/employees" className="text-sm text-gray-500 hover:text-gray-700 py-2">Clear</Link>
        </div>
      </form>

      {/* Position summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {(BRANCH_POSITIONS as EmployeePosition[]).map((pos) => {
          const count = employees.filter((e) => e.primaryPosition === pos && e.isActive).length;
          return (
            <Link key={pos} href={`/employees?position=${pos}`}
              className="bg-white rounded-xl border border-gray-200 p-3 text-center hover:shadow-md transition-shadow">
              <p className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold mb-1 ${POSITION_COLORS[pos]}`}>{pos}</p>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pos === "MO" ? "Agents" : pos === "AO" ? "Collectors" : pos === "MH" ? "Mktg Heads" : pos === "AM" ? "Area Mgrs" : pos === "BS" ? "Staff" : "Br. Mgrs"}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Emp. No.</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Positions</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Date Hired</th>
                <th className="px-4 py-3 text-left">Sponsor / Upline</th>
                {user.role === "ADMIN" && <th className="px-4 py-3 text-left">Branch</th>}
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((e) => (
                <tr key={e.id} className={`hover:bg-gray-50 ${!e.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.employeeNo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {e.firstName} {e.middleName ? e.middleName[0] + ". " : ""}{e.lastName}
                      {!e.isActive && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">INACTIVE</span>}
                    </div>
                    {e.nickname && <div className="text-xs text-gray-400">"{e.nickname}"</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {/* Primary position badge (highlighted) */}
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${POSITION_COLORS[e.primaryPosition] ?? "bg-gray-100 text-gray-600"}`}>
                        {e.primaryPosition}
                      </span>
                      {/* Additional positions */}
                      {e.positions
                        .filter((p) => p.position !== e.primaryPosition)
                        .map((p) => (
                          <span key={p.id} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium opacity-70 ${POSITION_COLORS[p.position] ?? "bg-gray-100 text-gray-600"}`}>
                            {p.position}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.contactNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(e.dateHired)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {e.sponsor ? `${e.sponsor.firstName} ${e.sponsor.lastName}` : "—"}
                  </td>
                  {user.role === "ADMIN" && (
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.branch.name}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${COMMISSION_POSITIONS.includes(e.primaryPosition as any) ? "text-orange-600" : "text-green-600"}`}>
                      {COMMISSION_POSITIONS.includes(e.primaryPosition as any) ? "Commission" : "Salaried"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/employees/${e.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    No employees found. <Link href="/employees/new" className="text-blue-600 hover:underline">Add the first employee.</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
