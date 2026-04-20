import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { MemberStatus, PlanCategory } from "@prisma/client";
import { formatDate, formatCurrency } from "@/lib/utils";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; branch?: string; page?: string; agent?: string; collector?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  const page = parseInt(searchParams.page ?? "1");
  const pageSize = 30;

  const where: any = {};
  if ((user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR")) where.branchId = user.branchId;
  if (searchParams.status) where.status = searchParams.status as MemberStatus;
  if (searchParams.branch && user.role === "ADMIN") where.branchId = searchParams.branch;
  if (searchParams.agent) where.agentId = searchParams.agent;
  if (searchParams.collector) where.collectorId = searchParams.collector;
  if (searchParams.search) {
    where.OR = [
      { mafNo: { contains: searchParams.search, mode: "insensitive" } },
      { firstName: { contains: searchParams.search, mode: "insensitive" } },
      { lastName: { contains: searchParams.search, mode: "insensitive" } },
      { contactNumber: { contains: searchParams.search } },
    ];
  }

  // Employee filter: only show agents/collectors for the staff's branch (or all for admin)
  const empBranchFilter = (user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR")
    ? { branchId: user.branchId }
    : (searchParams.branch && user.role === "ADMIN" ? { branchId: searchParams.branch } : {});

  const [members, total, branches, agents, collectors] = await Promise.all([
    db.member.findMany({
      where,
      include: { branch: true, agent: true, collector: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.member.count({ where }),
    user.role === "ADMIN" ? db.branch.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "MO", ...empBranchFilter },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, branch: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "AO", ...empBranchFilter },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, branch: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    LAPSED: "bg-red-100 text-red-700",
    REINSTATED: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-blue-100 text-blue-700",
    DECEASED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} total members</p>
        </div>
        <Link href="/members/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New Member
        </Link>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            name="search"
            defaultValue={searchParams.search}
            placeholder="MAF No., name, phone..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select name="status" defaultValue={searchParams.status ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            {Object.values(MemberStatus).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {user.role === "ADMIN" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Branch</label>
            <select name="branch" defaultValue={searchParams.branch ?? ""}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Agent (MO)</label>
          <select name="agent" defaultValue={searchParams.agent ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48">
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}{user.role === "ADMIN" ? ` · ${a.branch?.name ?? ""}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Collector (AO)</label>
          <select name="collector" defaultValue={searchParams.collector ?? ""}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48">
            <option value="">All Collectors</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}{user.role === "ADMIN" ? ` · ${c.branch?.name ?? ""}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="submit"
          className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Search
        </button>
        <Link href="/members" className="text-sm text-gray-500 hover:text-gray-700 py-2">Clear</Link>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">MAF No.</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">MOP</th>
                <th className="px-4 py-3 text-right">Monthly Due</th>
                <th className="px-4 py-3 text-left">Collector</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-center">Status</th>
                {user.role === "ADMIN" && <th className="px-4 py-3 text-left">Branch</th>}
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600 font-medium">{m.mafNo}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{m.firstName} {m.middleName ? m.middleName[0] + ". " : ""}{m.lastName}</div>
                    <div className="text-xs text-gray-400">{m.contactNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.planCategory}</td>
                  <td className="px-4 py-3 text-gray-600">{m.mopCode}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(m.monthlyDue))}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {m.collector ? `${m.collector.firstName} ${m.collector.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {m.agent ? `${m.agent.firstName} ${m.agent.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status] ?? ""}`}>
                      {m.status}
                    </span>
                  </td>
                  {user.role === "ADMIN" && (
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.branch.name}</td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <Link href={`/members/${m.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2">
                      View
                    </Link>
                    <Link href={`/members/${m.id}/edit`}
                      className="text-gray-500 hover:text-gray-700 text-xs font-medium">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/members?page=${page - 1}&status=${searchParams.status ?? ""}&search=${searchParams.search ?? ""}&branch=${searchParams.branch ?? ""}&agent=${searchParams.agent ?? ""}&collector=${searchParams.collector ?? ""}`}
                  className="px-3 py-1 border rounded hover:bg-gray-50">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/members?page=${page + 1}&status=${searchParams.status ?? ""}&search=${searchParams.search ?? ""}&branch=${searchParams.branch ?? ""}&agent=${searchParams.agent ?? ""}&collector=${searchParams.collector ?? ""}`}
                  className="px-3 py-1 border rounded hover:bg-gray-50">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
