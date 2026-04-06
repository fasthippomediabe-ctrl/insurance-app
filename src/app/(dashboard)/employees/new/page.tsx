import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import EmployeeForm from "@/components/employees/EmployeeForm";

export default async function NewEmployeePage() {
  const session = await auth();
  const user = session!.user as any;

  const [branches, sponsors] = await Promise.all([
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: {
        isActive: true,
        primaryPosition: { in: ["MH", "AM", "BM", "RM", "TH", "EVP", "CEO", "CHR"] },
        ...(user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {}),
      },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Employee</h1>
        <p className="text-gray-500 text-sm mt-1">Enroll a new team member into the system.</p>
      </div>
      <EmployeeForm
        branches={branches}
        sponsors={sponsors as any[]}
        defaultBranchId={user.branchId ?? ""}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
