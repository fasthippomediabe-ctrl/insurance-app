import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import NewIncomeForm from "@/components/accounting/NewIncomeForm";

export default async function NewIncomePage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const [categories, branches] = await Promise.all([
    db.incomeCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Income</h1>
        <p className="text-gray-500 text-sm mt-1">Capital contribution, processing fee, passbook fee, etc.</p>
      </div>
      <NewIncomeForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
        branches={branches}
      />
    </div>
  );
}
