import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import EditEmployeeForm from "@/components/employees/EditEmployeeForm";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const employee = await db.employee.findUnique({
    where: { id: params.id },
    include: { branch: true },
  });

  if (!employee) notFound();

  const branches = await db.branch.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Employee</h1>
        <p className="text-gray-500 text-sm mt-1">{employee.employeeNo} — {employee.firstName} {employee.lastName}</p>
      </div>
      <EditEmployeeForm
        employee={{
          id: employee.id,
          employeeNo: employee.employeeNo,
          firstName: employee.firstName,
          middleName: employee.middleName ?? "",
          lastName: employee.lastName,
          nickname: employee.nickname ?? "",
          dateOfBirth: employee.dateOfBirth?.toISOString().split("T")[0] ?? "",
          gender: employee.gender ?? "",
          civilStatus: employee.civilStatus ?? "",
          contactNumber: employee.contactNumber ?? "",
          address: employee.address ?? "",
          email: employee.email ?? "",
          photo: (employee as any).photo ?? null,
          dateHired: employee.dateHired.toISOString().split("T")[0],
          branchId: employee.branchId,
          primaryPosition: employee.primaryPosition,
        }}
        branches={branches}
        isAdmin={user.role === "ADMIN" || user.role === "HR"}
      />
    </div>
  );
}
