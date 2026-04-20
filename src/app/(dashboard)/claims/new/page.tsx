import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import NewClaimForm from "@/components/claims/NewClaimForm";

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: { memberId?: string };
}) {
  const session = await auth();
  const user = session!.user as any;
  const preselectedMemberId = searchParams.memberId ?? "";

  const branchFilter = (user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR") ? { branchId: user.branchId } : {};

  const members = await db.member.findMany({
    where: {
      ...branchFilter,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true, mafNo: true, firstName: true, lastName: true, planCategory: true,
      status: true, enrollmentDate: true, reinstatedDate: true, effectivityDate: true,
      beneficiaries: { select: { id: true, firstName: true, lastName: true, relationship: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">File New Claim</h1>
        <p className="text-gray-500 text-sm mt-1">Issue a claim stub for a deceased member or beneficiary</p>
      </div>
      <NewClaimForm
        members={members.map((m) => ({
          ...m,
          enrollmentDate: m.enrollmentDate.toISOString(),
          reinstatedDate: m.reinstatedDate?.toISOString() ?? null,
          effectivityDate: m.effectivityDate?.toISOString() ?? null,
        }))}
        preselectedMemberId={preselectedMemberId}
      />
    </div>
  );
}
