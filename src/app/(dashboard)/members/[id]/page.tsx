import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, MOP_LABELS, checkLapseStatus } from "@/lib/utils";
import PaymentLedger from "@/components/members/PaymentLedger";
import DeleteMemberButton from "@/components/members/DeleteMemberButton";

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
    },
  });

  if (!member) notFound();

  const totalPaid = member.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(member.totalPlanAmount) - totalPaid;
  const installmentsDone = member.payments.filter((p) => !p.isFree).length;
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

      {/* Payment Ledger */}
      <PaymentLedger
        payments={member.payments}
        effectivityDate={(member.effectivityDate ?? member.enrollmentDate).toString()}
        monthlyDue={Number(member.monthlyDue)}
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
