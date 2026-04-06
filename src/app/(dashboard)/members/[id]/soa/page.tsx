import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function SOAPage({ params }: { params: { id: string } }) {
  const member = await db.member.findUnique({
    where: { id: params.id },
    include: {
      payments: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }, { installmentNo: "asc" }] },
      agent: true,
      collector: true,
      branch: true,
      beneficiaries: { orderBy: { order: "asc" } },
    },
  });

  if (!member) notFound();

  const totalPlanAmount = Number(member.totalPlanAmount);
  const monthlyDue = Number(member.monthlyDue);
  const totalPaid = member.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalPlanAmount - totalPaid;
  const paidInstallments = member.payments.filter((p) => !p.isFree).length;
  const freeInstallments = member.payments.filter((p) => p.isFree).length;

  // Compute running balance for each payment
  let runningPaid = 0;
  const paymentsWithBalance = member.payments.map((p) => {
    runningPaid += Number(p.amount);
    return { ...p, amount: Number(p.amount), runningPaid, runningBalance: totalPlanAmount - runningPaid };
  });

  // Compute months covered: how many months of coverage each payment represents
  function monthsCovered(amount: number): number {
    if (monthlyDue <= 0) return 0;
    return Math.round(amount / monthlyDue);
  }

  // Status display
  const statusColors: Record<string, string> = {
    ACTIVE: "text-green-700 bg-green-100",
    REINSTATED: "text-blue-700 bg-blue-100",
    FULLY_PAID: "text-purple-700 bg-purple-100",
    LAPSED: "text-red-700 bg-red-100",
    DECEASED_CLAIMANT: "text-gray-700 bg-gray-200",
    CANCELLED: "text-gray-500 bg-gray-100",
  };

  // Print date — consistent format to avoid hydration issues
  const now = new Date();
  const printDate = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Controls — hidden on print */}
      <div className="mb-4 print:hidden flex items-center gap-3">
        <Link href={`/members/${member.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Back to Member</Link>
        <div className="flex-1" />
        <PrintButton label="Print SOA" />
      </div>

      {/* SOA Document */}
      <div id="soa-print" className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 print:shadow-none print:border-none print:rounded-none print:p-4">
        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
          <p className="text-xs text-gray-500 tracking-widest uppercase">Triple J Corp.</p>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide mt-1">
            Statement of Account
          </h1>
          <p className="text-sm text-gray-600 mt-1">{member.branch.name}</p>
        </div>

        {/* Member Info Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-5">
          <div className="col-span-2 flex items-center gap-2 mb-1">
            <span className="text-gray-500">Member:</span>
            <strong className="text-gray-900 text-base">
              {member.lastName}, {member.firstName} {member.middleName || ""}
            </strong>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[member.status] ?? "bg-gray-100 text-gray-600"}`}>
              {member.status.replace("_", " ")}
            </span>
          </div>
          <div><span className="text-gray-500">MAF No.:</span> <strong className="font-mono">{member.mafNo}</strong></div>
          <div><span className="text-gray-500">Plan:</span> <strong>{member.planCategory}</strong> / <span className="text-gray-600">{member.mopCode}</span></div>
          <div><span className="text-gray-500">Monthly Due:</span> <strong>{formatCurrency(monthlyDue)}</strong></div>
          <div><span className="text-gray-500">Total Contract:</span> <strong>{formatCurrency(totalPlanAmount)}</strong></div>
          <div><span className="text-gray-500">Enrollment:</span> <strong>{formatDate(member.enrollmentDate)}</strong></div>
          <div><span className="text-gray-500">Effectivity:</span> <strong>{formatDate(member.effectivityDate)}</strong></div>
          {member.agent && (
            <div><span className="text-gray-500">Agent:</span> <strong>{member.agent.firstName} {member.agent.lastName}</strong></div>
          )}
          {member.collector && (
            <div><span className="text-gray-500">Collector:</span> <strong>{member.collector.firstName} {member.collector.lastName}</strong></div>
          )}
          <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="text-gray-700">{member.address || "—"}</span></div>
        </div>

        {/* Payment Table */}
        <table className="w-full text-xs mb-5 border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-600 px-2 py-1.5 text-center w-10">#</th>
              <th className="border border-gray-600 px-2 py-1.5 text-left">Period</th>
              <th className="border border-gray-600 px-2 py-1.5 text-left">Date Paid</th>
              <th className="border border-gray-600 px-2 py-1.5 text-left">OR No.</th>
              <th className="border border-gray-600 px-2 py-1.5 text-center">Months</th>
              <th className="border border-gray-600 px-2 py-1.5 text-right">Amount</th>
              <th className="border border-gray-600 px-2 py-1.5 text-right">Total Paid</th>
              <th className="border border-gray-600 px-2 py-1.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {paymentsWithBalance.map((p, i) => {
              const mc = p.isFree ? 1 : monthsCovered(p.amount);
              return (
                <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-500">{p.installmentNo}</td>
                  <td className="border border-gray-200 px-2 py-1">{MONTHS[p.periodMonth - 1]} {p.periodYear}</td>
                  <td className="border border-gray-200 px-2 py-1">{formatDate(p.paymentDate)}</td>
                  <td className="border border-gray-200 px-2 py-1 text-gray-500">{p.orNo || "—"}</td>
                  <td className="border border-gray-200 px-2 py-1 text-center">
                    {p.isFree ? (
                      <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">FREE</span>
                    ) : mc > 1 ? (
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{mc} mos</span>
                    ) : (
                      <span className="text-gray-400">1</span>
                    )}
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-right font-medium">
                    {p.isFree ? (
                      <span className="text-blue-500">₱0.00</span>
                    ) : (
                      formatCurrency(p.amount)
                    )}
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-right text-green-700">
                    {formatCurrency(p.runningPaid)}
                  </td>
                  <td className={`border border-gray-200 px-2 py-1 text-right font-medium ${
                    p.runningBalance <= 0 ? "text-green-700" : "text-gray-700"
                  }`}>
                    {p.runningBalance <= 0 ? "PAID" : formatCurrency(p.runningBalance)}
                  </td>
                </tr>
              );
            })}
            {member.payments.length === 0 && (
              <tr>
                <td colSpan={8} className="border border-gray-200 px-3 py-6 text-center text-gray-400">
                  No payments on record.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Summary Box */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm">
            <p className="font-semibold text-gray-700 border-b pb-1 mb-1">Account Summary</p>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Contract (60 months):</span>
              <span className="font-medium">{formatCurrency(totalPlanAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Paid:</span>
              <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-bold text-base">
              <span>Remaining Balance:</span>
              <span className={balance > 0 ? "text-red-600" : "text-green-600"}>
                {balance <= 0 ? "FULLY PAID" : formatCurrency(balance)}
              </span>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm">
            <p className="font-semibold text-gray-700 border-b pb-1 mb-1">Payment Summary</p>
            <div className="flex justify-between">
              <span className="text-gray-500">Paid Installments:</span>
              <span className="font-medium">{paidInstallments} of 60</span>
            </div>
            {freeInstallments > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Free Month(s):</span>
                <span className="font-medium text-blue-600">{freeInstallments}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Months Covered:</span>
              <span className="font-medium">
                {freeInstallments + (monthlyDue > 0 ? Math.round(totalPaid / monthlyDue) : paidInstallments)} of 60
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Remaining Months:</span>
              <span className="font-medium">
                {Math.max(0, 60 - freeInstallments - (monthlyDue > 0 ? Math.round(totalPaid / monthlyDue) : paidInstallments))}
              </span>
            </div>
          </div>
        </div>

        {/* Beneficiaries */}
        {member.beneficiaries.length > 0 && (
          <div className="mb-6">
            <p className="font-semibold text-gray-700 text-sm mb-2">Beneficiaries</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 text-left">#</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Name</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Relationship</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Date of Birth</th>
                  <th className="border border-gray-200 px-2 py-1 text-center">Age</th>
                </tr>
              </thead>
              <tbody>
                {member.beneficiaries.map((b) => (
                  <tr key={b.id}>
                    <td className="border border-gray-200 px-2 py-1 text-gray-500">{b.order}</td>
                    <td className="border border-gray-200 px-2 py-1 font-medium">{b.firstName} {b.lastName}</td>
                    <td className="border border-gray-200 px-2 py-1">{b.relationship}</td>
                    <td className="border border-gray-200 px-2 py-1">{formatDate(b.dateOfBirth)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-center">{b.age ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400">
          <div>
            <p>Generated: {printDate}</p>
            <p>Triple J Corp. — {member.branch.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center w-40">
              <div className="border-t border-gray-400 pt-1 text-gray-600">Member&apos;s Signature</div>
            </div>
            <div className="text-center w-40">
              <div className="border-t border-gray-400 pt-1 text-gray-600">Authorized Representative</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
