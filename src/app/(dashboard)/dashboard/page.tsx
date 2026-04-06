import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, MONTHS, PRODUCTION_POINTS } from "@/lib/utils";
import { PlanCategory } from "@prisma/client";
import Link from "next/link";
import DashboardFilterBar from "@/components/dashboard/DashboardFilterBar";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  const now = new Date();
  const currentMonth = parseInt(searchParams.month ?? "") || (now.getMonth() + 1);
  const currentYear = parseInt(searchParams.year ?? "") || now.getFullYear();

  const branchFilter = user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {};
  const memberBranchFilter = branchFilter.branchId ? { member: { branchId: branchFilter.branchId } } : {};

  // ── Core stats ──
  const [
    totalMembers,
    activeMembers,
    lapsedMembers,
    fullyPaidMembers,
    newEnrollments,
    reinstatedThisMonth,
    monthlyCollection,
    totalRemittances,
    monthlyRemittances,
    recentRemittances,
    collectors,
    pendingEditRequests,
  ] = await Promise.all([
    db.member.count({ where: branchFilter }),
    db.member.count({ where: { ...branchFilter, status: { in: ["ACTIVE", "REINSTATED", "FULLY_PAID"] } } }),
    db.member.count({ where: { ...branchFilter, status: "LAPSED" } }),
    db.member.count({ where: { ...branchFilter, status: "FULLY_PAID" } }),
    db.member.count({
      where: { ...branchFilter, operationMonth: currentMonth, operationYear: currentYear },
    }),
    // Reinstated this month
    db.member.count({
      where: {
        ...branchFilter,
        status: "REINSTATED",
        reinstatedDate: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
      },
    }),
    db.payment.aggregate({
      where: {
        ...memberBranchFilter,
        periodMonth: currentMonth,
        periodYear: currentYear,
        isFree: false,
      },
      _sum: { amount: true },
      _count: true,
    }),
    db.remittance.count({ where: branchFilter.branchId ? { branchId: branchFilter.branchId } : {} }),
    db.remittance.count({
      where: {
        ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
        periodMonth: currentMonth,
        periodYear: currentYear,
      },
    }),
    db.remittance.findMany({
      where: branchFilter.branchId ? { branchId: branchFilter.branchId } : {},
      include: {
        collector: { select: { firstName: true, lastName: true, employeeNo: true } },
        branch: { select: { name: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.employee.findMany({
      where: {
        isActive: true,
        primaryPosition: "AO",
        ...branchFilter,
        collectorBalance: { not: 0 },
      },
      select: { firstName: true, lastName: true, employeeNo: true, collectorBalance: true },
      orderBy: { collectorBalance: "asc" },
      take: 5,
    }),
    user.role === "ADMIN"
      ? Promise.all([
          db.paymentEditRequest.count({ where: { status: "PENDING" } }),
          db.memberEditRequest.count({ where: { status: "PENDING" } }),
        ]).then(([a, b]) => a + b)
      : 0,
  ]);

  // ── Top Performing Agents (NE + Production this month) ──
  const agentsWithNE = await db.member.groupBy({
    by: ["agentId"],
    where: {
      ...branchFilter,
      operationMonth: currentMonth,
      operationYear: currentYear,
      agentId: { not: null },
    },
    _count: true,
  });

  const agentIds = agentsWithNE.map((a) => a.agentId).filter((id): id is string => id !== null);
  const agentDetails = agentIds.length > 0
    ? await db.employee.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, firstName: true, lastName: true, primaryPosition: true },
      })
    : [];

  // Get production for agents this month
  const agentMembers = agentIds.length > 0
    ? await db.member.findMany({
        where: {
          ...branchFilter,
          agentId: { in: agentIds },
          status: { in: ["ACTIVE", "REINSTATED"] },
        },
        select: { agentId: true, planCategory: true, id: true },
      })
    : [];

  const agentPayments = agentIds.length > 0
    ? await db.payment.findMany({
        where: {
          ...memberBranchFilter,
          periodMonth: currentMonth,
          periodYear: currentYear,
          isFree: false,
          installmentNo: { gte: 1, lte: 12 },
          member: { agentId: { in: agentIds } },
        },
        select: { memberId: true, member: { select: { agentId: true, planCategory: true } } },
      })
    : [];

  // Calculate production per agent
  const agentProductionMap = new Map<string, number>();
  for (const p of agentPayments) {
    const aId = p.member.agentId;
    if (!aId) continue;
    const pts = PRODUCTION_POINTS[p.member.planCategory as PlanCategory] ?? 0;
    agentProductionMap.set(aId, (agentProductionMap.get(aId) ?? 0) + pts);
  }

  const topAgents = agentsWithNE
    .filter((a) => a.agentId !== null)
    .map((a) => {
      const emp = agentDetails.find((e) => e.id === a.agentId);
      return {
        name: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        position: emp?.primaryPosition ?? "MO",
        ne: a._count,
        production: agentProductionMap.get(a.agentId!) ?? 0,
      };
    })
    .sort((a, b) => b.ne - a.ne)
    .slice(0, 8);

  // ── Monthly Collection Trend (past 6 months) ──
  const trendMonths: { month: number; year: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m <= 0) { m += 12; y--; }
    trendMonths.push({ month: m, year: y, label: `${MONTHS[m - 1]?.slice(0, 3)} ${y}` });
  }

  const trendData = await Promise.all(
    trendMonths.map(async (t) => {
      const agg = await db.payment.aggregate({
        where: {
          ...memberBranchFilter,
          periodMonth: t.month,
          periodYear: t.year,
          isFree: false,
        },
        _sum: { amount: true },
        _count: true,
      });
      return {
        ...t,
        amount: Number(agg._sum.amount ?? 0),
        count: agg._count ?? 0,
      };
    })
  );

  const maxTrend = Math.max(...trendData.map((t) => t.amount), 1);

  // ── Collection Performance per Collector (DAP/TCP) ──
  const allCollectors = await db.employee.findMany({
    where: {
      isActive: true,
      ...branchFilter,
      collectorMembers: { some: { status: { in: ["ACTIVE", "REINSTATED"] } } },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  const collectorPerf: {
    name: string;
    totalAccounts: number;
    overdueAccounts: number;
    collectedAccounts: number;
    dapPct: number;
    totalDue: number;
    totalCollected: number;
    tcpPct: number;
  }[] = [];

  for (const col of allCollectors) {
    const members = await db.member.findMany({
      where: {
        collectorId: col.id,
        status: { in: ["ACTIVE", "REINSTATED"] },
        spotCash: false,
        mopCode: { not: "SPOT_CASH" },
      },
      select: {
        id: true,
        effectivityDate: true,
        enrollmentDate: true,
        mopCode: true,
        monthlyDue: true,
        payments: {
          where: { periodMonth: currentMonth, periodYear: currentYear, isFree: false },
          select: { amount: true },
        },
      },
    });

    let overdue = 0;
    let collected = 0;
    let totalDue = 0;
    let totalCol = 0;

    for (const m of members) {
      const due = Number(m.monthlyDue);
      // Check if member has a payment this month
      const paidThisMonth = m.payments.length > 0;
      const paidAmount = m.payments.reduce((s, p) => s + Number(p.amount), 0);

      // All active accounts are expected to pay — those without payment are overdue
      if (!paidThisMonth) {
        overdue++;
        totalDue += due;
      } else {
        collected++;
        totalCol += paidAmount;
      }
    }

    const total = members.length;
    const dapPct = overdue > 0 ? Math.round((collected / (overdue + collected)) * 100) : 100;
    const tcpPct = totalDue > 0 ? Math.round((totalCol / (totalDue + totalCol)) * 100) : 100;

    collectorPerf.push({
      name: `${col.firstName} ${col.lastName}`,
      totalAccounts: total,
      overdueAccounts: overdue,
      collectedAccounts: collected,
      dapPct,
      totalDue,
      totalCollected: totalCol,
      tcpPct,
    });
  }

  // ── Branch Comparison (Admin only) ──
  let branchComparison: {
    name: string;
    members: number;
    ne: number;
    collection: number;
    lapsed: number;
  }[] = [];

  if (user.role === "ADMIN") {
    const branches = await db.branch.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    branchComparison = await Promise.all(
      branches.map(async (b) => {
        const [members, ne, collection, lapsed] = await Promise.all([
          db.member.count({ where: { branchId: b.id, status: { in: ["ACTIVE", "REINSTATED"] } } }),
          db.member.count({ where: { branchId: b.id, operationMonth: currentMonth, operationYear: currentYear } }),
          db.payment.aggregate({
            where: {
              member: { branchId: b.id },
              periodMonth: currentMonth,
              periodYear: currentYear,
              isFree: false,
            },
            _sum: { amount: true },
          }),
          db.member.count({ where: { branchId: b.id, status: "LAPSED" } }),
        ]);
        return {
          name: b.name,
          members,
          ne,
          collection: Number(collection._sum.amount ?? 0),
          lapsed,
        };
      })
    );
  }

  // ── Upcoming Lapse Warnings (members with 2 cumulative unpaid months) ──
  const atRiskMembers = await db.member.findMany({
    where: {
      ...branchFilter,
      status: { in: ["ACTIVE", "REINSTATED"] },
      spotCash: false,
      mopCode: { not: "SPOT_CASH" },
    },
    select: {
      id: true,
      mafNo: true,
      firstName: true,
      lastName: true,
      effectivityDate: true,
      enrollmentDate: true,
      reinstatedDate: true,
      monthlyDue: true,
      agent: { select: { firstName: true, lastName: true } },
      payments: {
        select: { periodMonth: true, periodYear: true, isFree: true },
      },
    },
  });

  const lapseWarnings: {
    id: string;
    mafNo: string;
    name: string;
    unpaidMonths: number;
    agentName: string;
  }[] = [];

  for (const m of atRiskMembers) {
    const startDate = m.reinstatedDate ?? m.effectivityDate ?? m.enrollmentDate;
    if (!startDate) continue;

    const paidSet = new Set(
      m.payments.filter((p) => !p.isFree).map((p) => `${p.periodYear}-${p.periodMonth}`)
    );

    let unpaidCount = 0;
    const cursor = new Date(startDate);
    cursor.setDate(1);
    while (cursor <= now) {
      const mo = cursor.getMonth() + 1;
      const yr = cursor.getFullYear();
      if (!paidSet.has(`${yr}-${mo}`)) unpaidCount++;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // 2 unpaid months = at risk (3 = lapsed)
    if (unpaidCount === 2) {
      lapseWarnings.push({
        id: m.id,
        mafNo: m.mafNo,
        name: `${m.firstName} ${m.lastName}`,
        unpaidMonths: unpaidCount,
        agentName: m.agent ? `${m.agent.firstName} ${m.agent.lastName}` : "—",
      });
    }
  }

  const monthCollection = Number(monthlyCollection._sum.amount ?? 0);
  const monthPaymentCount = monthlyCollection._count ?? 0;
  const periodLabel = `${MONTHS[currentMonth - 1]} ${currentYear}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {user.role === "ADMIN" ? "All Branches" : user.branchName} — {periodLabel} Operation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DashboardFilterBar currentMonth={currentMonth} currentYear={currentYear} />
          <Link href="/members/new"
            className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + New Member
          </Link>
          <Link href="/remittance/new"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + New Remittance
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {pendingEditRequests > 0 && (
        <Link href="/admin/edit-requests"
          className="block bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 hover:bg-amber-100">
          <span className="font-semibold">{pendingEditRequests} pending edit request{pendingEditRequests > 1 ? "s" : ""}</span> — review and approve/reject
        </Link>
      )}

      {/* Stats Grid — 5 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Accounts" value={activeMembers.toLocaleString()} sub={`of ${totalMembers.toLocaleString()} total`} color="green" />
        <StatCard label="New Enrollments" value={newEnrollments.toLocaleString()} sub={periodLabel} color="blue" />
        <StatCard label="Reinstated" value={reinstatedThisMonth.toLocaleString()} sub={periodLabel} color="indigo" />
        <StatCard label="Collection This Month" value={formatCurrency(monthCollection)} sub={`${monthPaymentCount} payments`} color="purple" />
        <StatCard label="Lapsed Accounts" value={lapsedMembers.toLocaleString()} sub={lapsedMembers > 0 ? "needs attention" : "all good"} color={lapsedMembers > 0 ? "red" : "gray"} />
      </div>

      {/* Row: Collection Trend + Top Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly Collection Trend */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Collection Trend (6 Months)</h2>
          <div className="flex items-end gap-2 h-40">
            {trendData.map((t, i) => {
              const pct = maxTrend > 0 ? (t.amount / maxTrend) * 100 : 0;
              const isCurrent = t.month === currentMonth && t.year === currentYear;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-medium">{formatCurrency(t.amount)}</span>
                  <div className="w-full flex items-end" style={{ height: "100px" }}>
                    <div
                      className={`w-full rounded-t-md ${isCurrent ? "bg-purple-500" : "bg-purple-200"}`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] ${isCurrent ? "font-bold text-purple-700" : "text-gray-400"}`}>
                    {t.label}
                  </span>
                  <span className="text-[9px] text-gray-400">{t.count} pmt</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performing Agents */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Top Agents — {periodLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">By new enrollments this month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Agent</th>
                  <th className="px-4 py-2 text-center">Pos</th>
                  <th className="px-4 py-2 text-center">NE</th>
                  <th className="px-4 py-2 text-right">Production</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topAgents.map((a, i) => (
                  <tr key={i} className={i === 0 ? "bg-yellow-50" : ""}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {i === 0 && <span className="text-yellow-500 mr-1">★</span>}
                      {a.name}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{a.position}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-blue-700">{a.ne}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{a.production.toLocaleString()} pts</td>
                  </tr>
                ))}
                {topAgents.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No enrollments this month.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Collection Performance per Collector */}
      {collectorPerf.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Collector Performance — {periodLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">DAP &amp; TCP for the current month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Collector</th>
                  <th className="px-4 py-2.5 text-center">Total Accts</th>
                  <th className="px-4 py-2.5 text-center">Collected</th>
                  <th className="px-4 py-2.5 text-center">Overdue</th>
                  <th className="px-4 py-2.5 text-center">DAP %</th>
                  <th className="px-4 py-2.5 text-right">Collected Amt</th>
                  <th className="px-4 py-2.5 text-right">Overdue Amt</th>
                  <th className="px-4 py-2.5 text-center">TCP %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {collectorPerf.map((c, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{c.totalAccounts}</td>
                    <td className="px-4 py-3 text-center text-green-700 font-semibold">{c.collectedAccounts}</td>
                    <td className="px-4 py-3 text-center text-red-600">{c.overdueAccounts}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        c.dapPct >= 70 ? "bg-green-100 text-green-700" : c.dapPct >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      }`}>{c.dapPct}%</span>
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(c.totalCollected)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(c.totalDue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        c.tcpPct >= 75 ? "bg-green-100 text-green-700" : c.tcpPct >= 65 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      }`}>{c.tcpPct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branch Comparison (Admin only) */}
      {user.role === "ADMIN" && branchComparison.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Branch Comparison — {periodLabel}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Branch</th>
                  <th className="px-4 py-2.5 text-center">Active Members</th>
                  <th className="px-4 py-2.5 text-center">NE This Month</th>
                  <th className="px-4 py-2.5 text-right">Collection</th>
                  <th className="px-4 py-2.5 text-center">Lapsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {branchComparison.map((b, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium text-gray-800">{b.name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{b.members.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{b.ne}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(b.collection)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        b.lapsed > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>{b.lapsed}</span>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center">{branchComparison.reduce((s, b) => s + b.members, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-blue-700">{branchComparison.reduce((s, b) => s + b.ne, 0)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{formatCurrency(branchComparison.reduce((s, b) => s + b.collection, 0))}</td>
                  <td className="px-4 py-3 text-center text-red-700">{branchComparison.reduce((s, b) => s + b.lapsed, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Recent Remittances */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Recent Remittances</h2>
              <p className="text-xs text-gray-400 mt-0.5">{monthlyRemittances} this month · {totalRemittances} total</p>
            </div>
            <Link href="/remittance" className="text-sm text-purple-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Remittance No.</th>
                  <th className="px-4 py-2.5 text-left">Collector</th>
                  <th className="px-4 py-2.5 text-center">Entries</th>
                  <th className="px-4 py-2.5 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentRemittances.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/remittance/${r.id}`} className="font-mono text-xs text-gray-600 hover:text-purple-600">
                        {r.remittanceNo}
                      </Link>
                      <p className="text-xs text-gray-400">{new Date(r.remittanceDate).toLocaleDateString("en-PH")}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.collector.firstName} {r.collector.lastName}
                      {user.role === "ADMIN" && <span className="text-xs text-gray-400 ml-1">· {r.branch.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{r._count.payments}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(Number(r.netRemittance))}</td>
                  </tr>
                ))}
                {recentRemittances.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No remittances yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Lapse Warnings */}
          {lapseWarnings.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5 shadow-sm">
              <h3 className="font-semibold text-red-800 mb-1">Lapse Warnings</h3>
              <p className="text-xs text-red-500 mb-3">{lapseWarnings.length} member{lapseWarnings.length > 1 ? "s" : ""} with 2 unpaid months — will lapse if not collected</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lapseWarnings.slice(0, 15).map((w) => (
                  <Link key={w.id} href={`/members/${w.id}`}
                    className="block bg-white rounded-lg px-3 py-2 border border-red-100 hover:border-red-300 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{w.name}</span>
                      <span className="text-[10px] font-mono text-gray-400">{w.mafNo}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">Agent: {w.agentName}</span>
                      <span className="text-xs font-bold text-red-600">{w.unpaidMonths} months unpaid</span>
                    </div>
                  </Link>
                ))}
                {lapseWarnings.length > 15 && (
                  <p className="text-xs text-red-500 text-center pt-1">+{lapseWarnings.length - 15} more</p>
                )}
              </div>
            </div>
          )}

          {/* Member Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">Member Status</h3>
            <div className="space-y-2.5">
              <StatusBar label="Active" count={activeMembers} total={totalMembers} color="bg-green-500" />
              <StatusBar label="Lapsed" count={lapsedMembers} total={totalMembers} color="bg-red-500" />
              <StatusBar label="Fully Paid" count={fullyPaidMembers} total={totalMembers} color="bg-blue-500" />
              <StatusBar label="Other" count={totalMembers - activeMembers - lapsedMembers - fullyPaidMembers} total={totalMembers} color="bg-gray-300" />
            </div>
            <Link href="/members" className="text-xs text-blue-600 hover:underline mt-3 inline-block">View all members</Link>
          </div>

          {/* Collector Balances */}
          {collectors.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Collector Balances</h3>
              <div className="space-y-2">
                {collectors.map((c) => {
                  const bal = Number(c.collectorBalance);
                  return (
                    <div key={c.employeeNo} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{c.firstName} {c.lastName}</span>
                      <span className={`font-semibold ${bal < 0 ? "text-red-600" : "text-blue-600"}`}>
                        {bal < 0 ? `−₱${Math.abs(bal).toLocaleString()}` : `+₱${bal.toLocaleString()}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Link href="/collectors" className="text-xs text-blue-600 hover:underline mt-3 inline-block">View collectors</Link>
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">Quick Links</h3>
            <div className="space-y-1.5">
              <QuickLink href="/acr" label="Generate ACR" />
              <QuickLink href="/incentives" label="Incentives Report" />
              <QuickLink href="/collectors" label="Collector Performance" />
              <QuickLink href="/members?status=LAPSED" label="Lapsed Accounts" />
              {user.role === "ADMIN" && <QuickLink href="/admin/edit-requests" label="Edit Requests" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    red: "border-l-red-500",
    gray: "border-l-gray-300",
    indigo: "border-l-indigo-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${colors[color]} p-4 shadow-sm`}>
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-500">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between text-sm text-gray-700 hover:text-blue-600 py-1.5 px-2 rounded-lg hover:bg-gray-50">
      <span>{label}</span>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
