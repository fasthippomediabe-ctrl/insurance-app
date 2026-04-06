import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import ClaimDetail from "@/components/claims/ClaimDetail";

export default async function ClaimDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const claim = await db.claim.findUnique({
    where: { id: params.id },
    include: {
      member: {
        select: { mafNo: true, firstName: true, lastName: true, planCategory: true, totalPlanAmount: true,
          branch: { select: { name: true } } },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!claim) notFound();

  return (
    <ClaimDetail
      claim={{
        ...claim,
        approvedAmount: claim.approvedAmount ? Number(claim.approvedAmount) : null,
        releasedAmount: claim.releasedAmount ? Number(claim.releasedAmount) : null,
        totalPlanAmount: Number(claim.member.totalPlanAmount),
        filedDate: claim.filedDate.toISOString(),
        dateOfDeath: claim.dateOfDeath.toISOString(),
        dateReleased: claim.dateReleased?.toISOString() ?? null,
        submittedToHO: claim.submittedToHO?.toISOString() ?? null,
        approvedDate: claim.approvedDate?.toISOString() ?? null,
        documents: claim.documents.map((d) => ({
          id: d.id, docType: d.docType, fileName: d.fileName,
          fileData: d.fileData, createdAt: d.createdAt.toISOString(),
        })),
        member: { ...claim.member, branch: claim.member.branch?.name ?? "" },
      }}
      isAdmin={user.role === "ADMIN"}
    />
  );
}
