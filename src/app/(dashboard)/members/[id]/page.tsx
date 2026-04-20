import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, MOP_LABELS, checkLapseStatus } from "@/lib/utils";
import PaymentLedger from "@/components/members/PaymentLedger";
import DeleteMemberButton from "@/components/members/DeleteMemberButton";
import MarkLegacyClaimButton from "@/components/members/MarkLegacyClaimButton";

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const member = await db.member.findUnique({
    where: { id: params.id },
    include: {
      beneficiaries: { orderBy: { order: "asc" } },
      agent: true,
      collector: true,
      branch: true,
      payments: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] },
      claims: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!member) notFound();

  const monthlyDue = Number(member.monthlyDue);
  // Free months count as 1 month's payment value
  const totalPaid = member.payments.reduce((sum, p) => sum + (p.isFree ? monthlyDue : Number(p.amount)), 0);
  const balance = Math.max(0, Number(member.totalPlanAmount) - totalPaid);
  const installmentsDone = member.payments.length; // all payments including free
  const isLapsed = checkLapseStatus(
    member.payments.map((p) => ({ periodYear: p.periodYear, periodMonth: p.periodMonth })),
    member.effectivityDate ?? member.enrollmentDate,
    member.reinstatedDate
  );

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    LAPSED: "bg-red-100 text-red-700",
    REINSTATED: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-blue-100 text-blue-700",
    DECEASED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {member.firstName} {member.middleName ? member.middleName + " " : ""}{member.lastName}
            </h1>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[member.status]}`}>
              {isLapsed && member.status === "ACTIVE" ? "LAPSED (AUTO)" : member.status}
            </span>
            {member.claims.length > 0 && (() => {
              const c = member.claims[0];
              const isServed = c.status === "REJECTED";
              const deceasedLabel = c.deceasedType === "MEMBER" ? "MEMBER" : c.deceasedType === "BENEFICIARY" ? "BENEFICIARY" : "SPOT";
              return (
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold text-white ${isServed ? "bg-amber-600" : "bg-red-600"}`}>
                  {isServed ? "SERVED · " : "CLAIMED · "}{deceasedLabel}
                </span>
              );
            })()}
          </div>
          <p className="text-gray-500 text-sm mt-1 font-mono">MAF No: {member.mafNo}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "ADMIN" ? (
            <>
              <Link href={`/members/${member.id}/edit`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                Edit Member
              </Link>
              <DeleteMemberButton memberId={member.id} memberName={`${member.firstName} ${member.lastName}`} hasPayments={member.payments.length > 0} />
            </>
          ) : (
            <>
              <Link href={`/members/${member.id}/edit`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                Request Edit
              </Link>
              <DeleteMemberButton memberId={member.id} memberName={`${member.firstName} ${member.lastName}`} hasPayments={member.payments.length > 0} requiresApproval />
            </>
          )}
          <Link href={`/payments/new?memberId=${member.id}`}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
            + Payment
          </Link>
          <Link href={`/remittance/new`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">
            + Remittance
          </Link>
          {member.claims.length === 0 && (
            <>
              <Link href={`/claims/new?memberId=${member.id}`}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
                File Claim
              </Link>
              {user.role === "ADMIN" && (
                <MarkLegacyClaimButton
                  memberId={member.id}
                  memberName={`${member.firstName} ${member.lastName}`}
                  planCategory={member.planCategory}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Member Info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Plan Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Plan Information</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Branch" value={member.branch.name} />
              <InfoRow label="Enrollment Date" value={formatDate(member.enrollmentDate)} />
              <InfoRow label="Effectivity Date" value={formatDate(member.effectivityDate)} />
              <InfoRow label="Insurance Type" value={member.insuranceType.replace("_", " ")} />
              <InfoRow label="Plan Category" value={member.planCategory} />
              <InfoRow label="MOP Code" value={`${member.mopCode} — ${MOP_LABELS[member.mopCode]}`} />
              <InfoRow label="Monthly Due" value={formatCurrency(Number(member.monthlyDue))} />
              <InfoRow label="Total Plan Amount" value={formatCurrency(Number(member.totalPlanAmount))} />
              {member.spotCash && <InfoRow label="Spot Cash Amount" value={formatCurrency(Number(member.spotCashAmount))} />}
              <InfoRow label="Sales Agent" value={member.agent ? `${member.agent.firstName} ${member.agent.lastName}` : "—"} />
              <InfoRow label="Collector" value={member.collector ? `${member.collector.firstName} ${member.collector.lastName}` : "—"} />
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Personal Information</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Address" value={member.address} />
              <InfoRow label="Date of Birth" value={formatDate(member.dateOfBirth)} />
              <InfoRow label="Age" value={member.age?.toString() ?? "—"} />
              <InfoRow label="Gender" value={member.gender ?? "—"} />
              <InfoRow label="Civil Status" value={member.civilStatus ?? "—"} />
              <InfoRow label="Religion" value={member.religion ?? "—"} />
              <InfoRow label="Contact Number" value={member.contactNumber ?? "—"} />
              <InfoRow label="Occupation" value={member.occupation ?? "—"} />
            </div>
          </div>

          {/* Beneficiaries */}
          {member.beneficiaries.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Beneficiaries</h2>
              <div className="space-y-3">
                {member.beneficiaries.map((b) => (
                  <div key={b.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <p className="text-xs text-gray-400">Name</p>
                      <p className="font-medium">{b.firstName} {b.lastName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Relationship</p>
                      <p>{b.relationship}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Date of Birth</p>
                      <p>{formatDate(b.dateOfBirth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Age</p>
                      <p>{b.age ?? "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Summary sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 pb-2 border-b">Payment Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Installments Done</span>
                <span className="font-bold">{installmentsDone} / 60</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((installmentsDone / 60) * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Paid</span>
                <span className="font-bold text-green-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Balance</span>
                <span className="font-bold text-red-600">{formatCurrency(Math.max(0, balance))}</span>
              </div>
            </div>
          </div>

          {(isLapsed || member.status === "LAPSED") && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">Account Lapsed</p>
              <p>3 or more total unpaid months. Member needs to reinstate.</p>
              <Link href={`/members/${member.id}/reinstate`}
                className="mt-2 inline-block bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700">
                Process Reinstatement
              </Link>
            </div>
          )}

          <Link href={`/members/${member.id}/soa`}
            className="block w-full text-center bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-medium py-2.5 rounded-xl transition-colors">
            Print Statement of Account
          </Link>
        </div>
      </div>

      {/* Plan Usage / Claims */}
      {member.claims.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50 px-5 py-3 border-b border-red-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-bold text-red-800">Plan Used — Service Rendered</h2>
              <p className="text-xs text-red-600">This member has been flagged as deceased. See claim/service record(s) below.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {member.claims.map((c) => (
              <Link key={c.id} href={`/claims/${c.id}`} className="block px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-mono text-xs text-gray-500">{c.claimNo}</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      <span className="text-red-700">{c.deceasedType === "MEMBER" ? "MEMBER" : c.deceasedType === "BENEFICIARY" ? "BENEFICIARY" : "SPOT SERVICE"}</span>
                      {" · "}{c.deceasedName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Date of Death: {c.dateOfDeath.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                      {c.deathType && ` · ${c.deathType}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                      c.status === "RELEASED" ? "bg-green-100 text-green-700" :
                      c.status === "REJECTED" ? "bg-red-100 text-red-700" :
                      c.status === "APPROVED" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{c.status.replace(/_/g, " ")}</span>
                    {c.releasedAmount && (
                      <p className="text-xs text-green-700 font-bold mt-1">{formatCurrency(Number(c.releasedAmount))}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Payment Ledger */}
      <PaymentLedger
        payments={member.payments}
        effectivityDate={(member.effectivityDate ?? member.enrollmentDate).toString()}
        monthlyDue={Number(member.monthlyDue)}
        memberId={member.id}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}
