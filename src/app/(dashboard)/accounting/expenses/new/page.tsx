import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import NewExpenseForm from "@/components/accounting/NewExpenseForm";

export default async function NewExpensePage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const [categories, branches] = await Promise.all([
    db.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Expense</h1>
        <p className="text-gray-500 text-sm mt-1">Add a new expense entry to the books</p>
      </div>
      <NewExpenseForm categories={categories} branches={branches} />
    </div>
  );
}
