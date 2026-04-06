import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatCurrency, getMonthlyDue } from "@/lib/utils";
import ReinstateForm from "@/components/members/ReinstateForm";

export default async function ReinstatePage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const member = await db.member.findUnique({
    where: { id: params.id },
    include: {
      agent: { select: { id: true, firstName: true, lastName: true } },
      collector: { select: { id: true, firstName: true, lastName: true } },
      branch: { select: { id: true, name: true } },
      payments: {
        orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
        select: { periodMonth: true, periodYear: true, installmentNo: true, amount: true, isFree: true },
      },
    },
  });

  if (!member) notFound();

  // Calculate unpaid months
  const paidSet = new Set(member.payments.map(p => `${p.periodYear}-${p.periodMonth}`));
  const startDate = member.reinstatedDate ?? member.effectivityDate ?? member.enrollmentDate;
  const now = new Date();
  const unpaidMonths: { month: number; year: number }[] = [];
  const cursor = new Date(startDate);
  cursor.setDate(1);
  while (cursor <= now) {
    const m = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    if (!paidSet.has(`${y}-${m}`)) {
      unpaidMonths.push({ month: m, year: y });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const lastInstallment = member.payments.length > 0
    ? Math.max(...member.payments.map(p => p.installmentNo))
    : 0;

  const monthlyDue = Number(member.monthlyDue);

  // Get agents for reassignment
  const agents = await db.employee.findMany({
    where: { isActive: true, branchId: member.branchId, primaryPosition: "MO" },
    select: { id: true, firstName: true, lastName: true, employeeNo: true },
    orderBy: { lastName: "asc" },
  });

  // Also include MH, AM who can reinstate
  const otherAgents = await db.employee.findMany({
    where: {
      isActive: true, branchId: member.branchId,
      primaryPosition: { in: ["MH", "AM", "BM"] },
    },
    select: { id: true, firstName: true, lastName: true, employeeNo: true, primaryPosition: true },
    orderBy: { lastName: "asc" },
  });

  const allAgents = [...agents, ...otherAgents];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reinstate Member</h1>
        <p className="text-gray-500 text-sm mt-1">
          MAF No: {member.mafNo} — {member.firstName} {member.lastName}
        </p>
      </div>

      <ReinstateForm
        member={{
          id: member.id,
          mafNo: member.mafNo,
          firstName: member.firstName,
          lastName: member.lastName,
          planCategory: member.planCategory,
          mopCode: member.mopCode,
          monthlyDue,
          lastInstallment,
          currentAgentId: member.agentId ?? "",
          currentAgentName: member.agent ? `${member.agent.firstName} ${member.agent.lastName}` : "None",
          branchId: member.branchId,
        }}
        unpaidMonths={unpaidMonths}
        agents={allAgents.map(a => ({
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          position: (a as any).primaryPosition ?? "MO",
        }))}
      />
    </div>
  );
}
