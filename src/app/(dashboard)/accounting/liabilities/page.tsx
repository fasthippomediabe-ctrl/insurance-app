import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import LiabilitiesManager from "@/components/accounting/LiabilitiesManager";

export default async function LiabilitiesPage() {
  const session = await auth();
  const user = session!.user as any;
  if (user.role !== "ADMIN" && user.role !== "ACCOUNTING") redirect("/dashboard");

  const [liabilities, branches] = await Promise.all([
    db.liability.findMany({
      include: { payments: { orderBy: { payDate: "desc" } } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    db.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <LiabilitiesManager
      branches={branches}
      liabilities={liabilities.map((l) => ({
        id: l.id,
        liabilityNo: l.liabilityNo,
        lenderName: l.lenderName,
        lenderContact: l.lenderContact,
        branchId: l.branchId,
        principal: Number(l.principal),
        interestRate: Number(l.interestRate),
        totalPayable: Number(l.totalPayable),
        currentBalance: Number(l.currentBalance),
        frequency: l.frequency,
        paymentAmount: Number(l.paymentAmount),
        startDate: l.startDate.toISOString(),
        maturityDate: l.maturityDate?.toISOString() ?? null,
        termMonths: l.termMonths,
        purpose: l.purpose,
        status: l.status,
        notes: l.notes,
        payments: l.payments.map((p) => ({
          id: p.id,
          payDate: p.payDate.toISOString(),
          amount: Number(p.amount),
          principalPaid: Number(p.principalPaid),
          interestPaid: Number(p.interestPaid),
          penaltyPaid: Number(p.penaltyPaid),
          paymentMethod: p.paymentMethod,
          referenceNo: p.referenceNo,
          notes: p.notes,
        })),
      }))}
    />
  );
}
