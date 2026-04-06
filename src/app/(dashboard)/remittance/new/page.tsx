import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import NewRemittanceForm from "@/components/remittance/NewRemittanceForm";

export default async function NewRemittancePage() {
  const session = await auth();
  const user = session!.user as any;

  const branchFilter = user.role === "BRANCH_STAFF" ? { branchId: user.branchId } : {};

  // Auto-generate next remittance number for today
  const now = new Date();
  const datePrefix = `REM-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const [collectorsRaw, branches, branchStaff, branchManagers, collSupervisors, lastRem] = await Promise.all([
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "AO", ...branchFilter },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, branchId: true, collectorBalance: true },
      orderBy: { lastName: "asc" },
    }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "BS", ...branchFilter },
      select: { firstName: true, lastName: true },
      take: 1,
    }),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "BM", ...branchFilter },
      select: { firstName: true, lastName: true },
      take: 1,
    }),
    db.employee.findMany({
      where: { isActive: true, primaryPosition: "CS", ...branchFilter },
      select: { firstName: true, lastName: true },
      take: 1,
    }),
    db.remittance.findFirst({
      where: { remittanceNo: { startsWith: datePrefix } },
      orderBy: { remittanceNo: "desc" },
      select: { remittanceNo: true },
    }),
  ]);

  // Convert Prisma Decimal to plain number for serialization
  const collectors = collectorsRaw.map((c) => ({
    ...c,
    collectorBalance: Number(c.collectorBalance),
  }));

  const lastSeq = lastRem ? parseInt(lastRem.remittanceNo.split("-").pop() ?? "0") : 0;
  const nextRemNo = `${datePrefix}-${String(lastSeq + 1).padStart(3, "0")}`;

  const defaults = {
    receivedBy: branchStaff[0] ? `${branchStaff[0].firstName} ${branchStaff[0].lastName}` : user.username ?? "",
    collectionSupervisor: collSupervisors[0] ? `${collSupervisors[0].firstName} ${collSupervisors[0].lastName}` : "",
    branchManager: branchManagers[0] ? `${branchManagers[0].firstName} ${branchManagers[0].lastName}` : "",
    remittanceNo: nextRemNo,
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Remittance</h1>
        <p className="text-gray-500 text-sm mt-1">Record collection remittance from a collector (AO).</p>
      </div>
      <NewRemittanceForm
        collectors={collectors}
        branches={branches}
        defaultBranchId={user.branchId ?? ""}
        isAdmin={user.role === "ADMIN"}
        defaults={defaults}
      />
    </div>
  );
}
