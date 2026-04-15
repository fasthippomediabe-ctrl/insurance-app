import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import NewMemberForm from "@/components/members/NewMemberForm";

export default async function NewMemberPage() {
  const session = await auth();
  const user = session!.user as any;

  const branchFilter = (user.role === "BRANCH_STAFF" || user.role === "COLLECTION_SUPERVISOR") ? { branchId: user.branchId } : {};

  const [branches, agentRows, collectorRows] = await Promise.all([
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

  const agents = agentRows.map((e) => ({ ...e, code: e.employeeNo }));
  const collectors = collectorRows.map((e) => ({ ...e, code: e.employeeNo }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Register New Member</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in all required fields to enroll a new member.</p>
      </div>
      <NewMemberForm
        branches={branches}
        agents={agents}
        collectors={collectors}
        defaultBranchId={user.branchId ?? ""}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
