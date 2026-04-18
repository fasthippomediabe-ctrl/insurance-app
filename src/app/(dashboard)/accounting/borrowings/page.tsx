import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import BorrowingsManager from "@/components/accounting/BorrowingsManager";

const DEFAULT_SOURCES = ["Chapel", "Ascendryx", "Owner", "Bank", "Other"];

export default async function BorrowingsPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") redirect("/dashboard");

  // Seed default sources if none exist
  const count = await db.fundSource.count();
  if (count === 0) {
    for (const name of DEFAULT_SOURCES) {
      await db.fundSource.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
  }

  const [sources, borrowings, branches] = await Promise.all([
    db.fundSource.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.borrowing.findMany({
      include: {
        source: true,
        repayments: { orderBy: { payDate: "desc" } },
      },
      orderBy: { borrowedDate: "desc" },
      take: 100,
    }),
    db.branch.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <BorrowingsManager
      sources={sources.map((s) => ({ id: s.id, name: s.name }))}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      borrowings={borrowings.map((b) => ({
        id: b.id,
        borrowingNo: b.borrowingNo,
        sourceId: b.sourceId,
        sourceName: b.source.name,
        branchId: b.branchId,
        amount: Number(b.amount),
        balance: Number(b.balance),
        interestRate: Number(b.interestRate),
        borrowedDate: b.borrowedDate.toISOString(),
        dueDate: b.dueDate?.toISOString() ?? null,
        purpose: b.purpose,
        status: b.status,
        notes: b.notes,
        repayments: b.repayments.map((r) => ({
          id: r.id, amount: Number(r.amount), payDate: r.payDate.toISOString(),
          paymentMethod: r.paymentMethod, notes: r.notes,
        })),
      }))}
    />
  );
}
