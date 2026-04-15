import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete remittances." }, { status: 403 });
  }

  const remittance = await db.remittance.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      collectorId: true,
      netRemittance: true,
      totalDeposit: true,
    },
  });

  if (!remittance) {
    return NextResponse.json({ error: "Remittance not found." }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    // Reverse the collector balance adjustment
    const deposit = Number(remittance.totalDeposit ?? remittance.netRemittance);
    const net = Number(remittance.netRemittance);
    const variance = deposit - net;
    if (variance !== 0) {
      await tx.employee.update({
        where: { id: remittance.collectorId },
        data: { collectorBalance: { decrement: variance } },
      });
    }

    // Delete linked payments first (FK constraint)
    await tx.payment.deleteMany({ where: { remittanceId: params.id } });

    // Delete linked commissions
    await tx.commission.deleteMany({ where: { remittanceId: params.id } });

    // Delete the remittance
    await tx.remittance.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
