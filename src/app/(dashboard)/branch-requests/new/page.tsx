import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import NewBranchRequestForm from "@/components/branch-requests/NewBranchRequestForm";

export default async function NewBranchRequestPage() {
  const session = await auth();
  const user = session!.user as any;

  const branches = await db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Branch Request</h1>
        <p className="text-gray-500 text-sm mt-1">Submit a payment, expense, or liability request to Head Office</p>
      </div>
      <NewBranchRequestForm branches={branches} role={user.role} defaultBranchId={user.branchId ?? ""} />
    </div>
  );
}
