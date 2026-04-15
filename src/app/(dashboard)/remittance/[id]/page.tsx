import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { BC_RATES, TA_RATES, isCommissionable } from "@/lib/utils";
import { PlanCategory } from "@prisma/client";
import RemittancePrintView from "@/components/remittance/RemittancePrintView";

const PLAN_ABBR: Record<PlanCategory, string> = {
  EUCALYPTUS: "EUC",
  CHERRY: "CHE",
  CONIFER: "CON",
  ROSEWOOD: "ROS",
};

export default async function RemittanceDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const [remittance, collectors] = await Promise.all([
    db.remittance.findUnique({
      where: { id: params.id },
      include: {
        collector: { select: { firstName: true, lastName: true, employeeNo: true } },
        branch: { select: { name: true } },
        payments: {
          include: { member: { select: { mafNo: true, firstName: true, lastName: true, planCategory: true } } },
          orderBy: { orNo: "asc" },
        },
      },
    }),
    db.employee.findMany({
      where: {
        isActive: true,
        primaryPosition: "AO",
        ...((user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR") ? { branchId: user.branchId } : {}),
      },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  if (!remittance) notFound();

  // Get prior paid payment counts per member (before this remittance)
  const memberIds = [...new Set(remittance.payments.map((p) => p.memberId))];
  const priorCounts = await Promise.all(
    memberIds.map(async (id) => ({
      id,
      count: await db.payment.count({
        where: { memberId: id, isFree: false, remittanceId: { not: remittance.id } },
      }),
    }))
  );
  const priorCountMap = new Map(priorCounts.map((c) => [c.id, c.count]));

  // Track paid installments per member within this remittance (for TA calculation)
  const memberPaidIdx = new Map<string, number>();

  // Build enriched rows — include full payment fields for edit modal
  const rows = remittance.payments.map((p, idx) => {
    const plan = p.member.planCategory as PlanCategory;
    const comm = isCommissionable(p.installmentNo);

    // FREE payments: no BC, no TA
    // First-ever paid payment: BC yes, TA no
    let bc = 0;
    let ta = 0;
    if (comm && !p.isFree) {
      bc = BC_RATES[plan];
      const priorPaid = priorCountMap.get(p.memberId) ?? 0;
      const paidIdxInRem = memberPaidIdx.get(p.memberId) ?? 0;
      if (priorPaid + paidIdxInRem > 0) {
        ta = TA_RATES[plan];
      }
      memberPaidIdx.set(p.memberId, paidIdxInRem + 1);
    }

    const others = Number(p.othersDeduction ?? 0);
    const amount = Number(p.amount);
    const net = amount - bc - ta - others;
    return {
      seq: idx + 1,
      // display fields
      orNo: p.orNo ?? "",
      orDate: p.orDate ? new Date(p.orDate) : new Date(p.paymentDate),
      mafNo: p.member.mafNo,
      memberName: `${p.member.firstName} ${p.member.lastName}`,
      planAbbr: PLAN_ABBR[plan],
      installmentNo: p.installmentNo,
      isComm: comm,
      amount,
      comm: comm ? amount : 0,
      nonComm: comm ? 0 : amount,
      others,
      ta,
      bc,
      net,
      // full payment fields for EditPaymentModal
      payment: {
        id: p.id,
        periodMonth: p.periodMonth,
        periodYear: p.periodYear,
        installmentNo: p.installmentNo,
        paymentDate: p.paymentDate.toISOString(),
        amount,
        isFree: p.isFree,
        isSpotCash: p.isSpotCash,
        paymentMethod: p.paymentMethod as string,
        collectorId: p.collectorId,
        notes: p.notes,
        member: { mafNo: p.member.mafNo, firstName: p.member.firstName, lastName: p.member.lastName },
      },
    };
  });

  // Group rows by OR number + member (multi-month payments share the same OR)
  const groupMap = new Map<string, typeof rows[0] & { installmentRange: string; payments: typeof rows[0]["payment"][] }>();
  for (const row of rows) {
    const key = `${row.orNo}|${row.mafNo}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.amount += row.amount;
      existing.comm += row.comm;
      existing.nonComm += row.nonComm;
      existing.others += row.others;
      existing.ta += row.ta;
      existing.bc += row.bc;
      existing.net += row.net;
      existing.payments.push(row.payment);
      const instNos = existing.payments.map((p) => p.installmentNo).sort((a, b) => a - b);
      existing.installmentRange = instNos.length === 1
        ? String(instNos[0])
        : `${instNos[0]}-${instNos[instNos.length - 1]}`;
    } else {
      groupMap.set(key, {
        ...row,
        installmentRange: String(row.installmentNo),
        payments: [row.payment],
      });
    }
  }
  const groupedRows = [...groupMap.values()].map((r, i) => ({ ...r, seq: i + 1 }));

  const totals = {
    comm:    rows.reduce((s, r) => s + r.comm, 0),
    nonComm: rows.reduce((s, r) => s + r.nonComm, 0),
    others:  rows.reduce((s, r) => s + r.others, 0),
    ta:      rows.reduce((s, r) => s + r.ta, 0),
    bc:      rows.reduce((s, r) => s + r.bc, 0),
    net:     rows.reduce((s, r) => s + r.net, 0),
    gross:   rows.reduce((s, r) => s + r.amount, 0),
  };

  const data = {
    remittanceNo:         remittance.remittanceNo,
    remittanceDate:       new Date(remittance.remittanceDate),
    periodMonth:          remittance.periodMonth,
    periodYear:           remittance.periodYear,
    collectorName:        `${remittance.collector.firstName} ${remittance.collector.lastName}`,
    collectorCode:        remittance.collector.employeeNo,
    branchName:           remittance.branch.name,
    receivedBy:           remittance.receivedBy ?? "",
    collectionSupervisor: remittance.collectionSupervisor ?? "",
    branchManagerName:    remittance.branchManagerName ?? "",
    totalDeposit:         remittance.totalDeposit ? Number(remittance.totalDeposit) : null,
    netRemittance:        totals.gross - totals.bc - totals.ta - totals.others,
    rows: groupedRows,
    totals,
  };

  const collectorList = collectors.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    code: c.employeeNo,
  }));

  return (
    <RemittancePrintView
      data={data}
      collectors={collectorList}
      remittanceId={remittance.id}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
