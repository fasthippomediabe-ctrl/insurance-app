import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import EditMemberForm from "@/components/members/EditMemberForm";

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const member = await db.member.findUnique({
    where: { id: params.id },
    include: { agent: true, collector: true, branch: true },
  });

  if (!member) notFound();

  const branchFilter = user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {};

  const [branches, agents, collectors] = await Promise.all([
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "MO", ...branchFilter },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
      orderBy: { lastName: "asc" },
    }),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "AO", ...branchFilter },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Member</h1>
        <p className="text-gray-500 text-sm mt-1">MAF No: {member.mafNo} — {member.firstName} {member.lastName}</p>
      </div>
      <EditMemberForm
        member={{
          id: member.id,
          mafNo: member.mafNo,
          firstName: member.firstName,
          middleName: member.middleName ?? "",
          lastName: member.lastName,
          address: member.address,
          dateOfBirth: member.dateOfBirth?.toISOString().split("T")[0] ?? "",
          contactNumber: member.contactNumber ?? "",
          occupation: member.occupation ?? "",
          civilStatus: member.civilStatus ?? "",
          gender: member.gender ?? "",
          religion: member.religion ?? "",
          planCategory: member.planCategory,
          mopCode: member.mopCode,
          insuranceType: member.insuranceType,
          status: member.status,
          branchId: member.branchId,
          agentId: member.agentId ?? "",
          collectorId: member.collectorId ?? "",
          enrollmentDate: member.enrollmentDate.toISOString().split("T")[0],
          effectivityDate: member.effectivityDate?.toISOString().split("T")[0] ?? "",
          operationMonth: member.operationMonth,
          operationYear: member.operationYear,
        }}
        branches={branches}
        agents={agents.map(e => ({ ...e, code: e.employeeNo }))}
        collectors={collectors.map(e => ({ ...e, code: e.employeeNo }))}
        isAdmin={user.role === "ADMIN"}
        userId={user.id}
      />
    </div>
  );
}
