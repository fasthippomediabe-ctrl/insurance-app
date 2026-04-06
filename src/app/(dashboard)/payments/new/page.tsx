import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import RecordPaymentForm from "@/components/payments/RecordPaymentForm";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: { memberId?: string };
}) {
  const session = await auth();
  const user = session!.user as any;

  const [members, collectors] = await Promise.all([
    db.member.findMany({
      where: user.role === "BRANCH_STAFF" ? { branchId: user.branchId, status: { in: ["ACTIVE", "REINSTATED"] } } : { status: { in: ["ACTIVE", "REINSTATED"] } },
      select: { id: true, mafNo: true, firstName: true, lastName: true, monthlyDue: true, mopCode: true, effectivityDate: true, enrollmentDate: true },
      orderBy: { mafNo: "asc" },
    }),
    db.employee.findMany({
      where: {
        isActive: true,
        primaryPosition: "AO",
        ...(user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {}),
      },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
        <p className="text-gray-500 text-sm mt-1">Record a member's premium payment.</p>
      </div>
      <RecordPaymentForm
        members={members as any[]}
        collectors={collectors.map((e) => ({ ...e, code: e.employeeNo }))}
        defaultMemberId={searchParams.memberId ?? ""}
      />
    </div>
  );
}
