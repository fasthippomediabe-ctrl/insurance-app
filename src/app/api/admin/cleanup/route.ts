import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/admin/cleanup — Fix imported data issues
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body as { action: string };
  const log: string[] = [];

  try {
    if (action === "fix-fake-employees") {
      // 1. "FULLY PAID/ACTIVE" is not a real person — it means the member is fully paid
      // Reassign those members' agentId to null (or the actual agent from the CSV)
      const fakeAgent = await db.employee.findFirst({
        where: { firstName: "FULLY", lastName: { startsWith: "PAID" } },
      });
      if (fakeAgent) {
        const updated = await db.member.updateMany({
          where: { agentId: fakeAgent.id },
          data: { agentId: null },
        });
        log.push(`Unassigned ${updated.count} members from "FULLY PAID/ACTIVE" agent`);
        // Don't delete yet — check if referenced elsewhere
      }

      // 2. "DECEASED DECEASED" is not a real collector — means the member is deceased
      const fakeCollector = await db.employee.findFirst({
        where: { firstName: "DECEASED" },
      });
      if (fakeCollector) {
        const updated = await db.member.updateMany({
          where: { collectorId: fakeCollector.id },
          data: { collectorId: null },
        });
        log.push(`Unassigned ${updated.count} members from "DECEASED" collector`);
      }

      // 3. "Salaried Collectors" is a label, not a person
      const salariedCollector = await db.employee.findFirst({
        where: { firstName: "Salaried" },
      });
      if (salariedCollector) {
        const updated = await db.member.updateMany({
          where: { collectorId: salariedCollector.id },
          data: { collectorId: null },
        });
        log.push(`Unassigned ${updated.count} members from "Salaried Collectors"`);
      }

      // Now delete the fake employees (after unassigning)
      const fakeIds = [fakeAgent?.id, fakeCollector?.id, salariedCollector?.id].filter(Boolean) as string[];
      if (fakeIds.length > 0) {
        // Remove any payments referencing them as collector
        await db.payment.updateMany({
          where: { collectorId: { in: fakeIds } },
          data: { collectorId: null },
        });
        // Delete position records
        await db.employeePositionRecord.deleteMany({
          where: { employeeId: { in: fakeIds } },
        });
        const deleted = await db.employee.deleteMany({
          where: { id: { in: fakeIds } },
        });
        log.push(`Deleted ${deleted.count} fake employee records`);
      }
    }

    if (action === "merge-duplicates") {
      // Merge duplicate employees (keep the first, reassign all references to it)
      const duplicates: [string, string][] = [
        // [wrong name pattern, correct name pattern] — we'll merge by finding both
      ];

      // Find and merge specific known duplicates
      const mergeList = [
        { wrongFirst: "HIENRICH", wrongLast: "GARBO", correctFirst: "HEINRICH", correctLast: "GARBO" },
        { wrongFirst: "MARLON", wrongLast: "INCENARES", correctFirst: "MARLON", correctLast: "ENCINARES" },
        { wrongFirst: "THRESA", wrongLast: "PINO", correctFirst: "THERESA", correctLast: "PINO" },
        { wrongFirst: "ABDUL", wrongLast: "TANAGUB", correctFirst: "ABDUL", correctLast: "L.TANAGUB" },
      ];

      for (const m of mergeList) {
        const wrong = await db.employee.findFirst({
          where: { firstName: m.wrongFirst, lastName: m.wrongLast },
        });
        const correct = await db.employee.findFirst({
          where: { firstName: m.correctFirst, lastName: m.correctLast },
        });

        if (wrong && correct && wrong.id !== correct.id) {
          // Reassign all members from wrong to correct
          const agentUpdate = await db.member.updateMany({
            where: { agentId: wrong.id },
            data: { agentId: correct.id },
          });
          const collectorUpdate = await db.member.updateMany({
            where: { collectorId: wrong.id },
            data: { collectorId: correct.id },
          });
          const paymentUpdate = await db.payment.updateMany({
            where: { collectorId: wrong.id },
            data: { collectorId: correct.id },
          });

          // Delete the wrong employee
          await db.employeePositionRecord.deleteMany({ where: { employeeId: wrong.id } });
          await db.employee.delete({ where: { id: wrong.id } });

          log.push(`Merged "${m.wrongFirst} ${m.wrongLast}" → "${m.correctFirst} ${m.correctLast}" (${agentUpdate.count} agent, ${collectorUpdate.count} collector refs)`);
        } else if (!wrong) {
          log.push(`Skip: "${m.wrongFirst} ${m.wrongLast}" not found`);
        } else if (!correct) {
          // Rename the wrong one to the correct name
          await db.employee.update({
            where: { id: wrong.id },
            data: { firstName: m.correctFirst, lastName: m.correctLast },
          });
          log.push(`Renamed "${m.wrongFirst} ${m.wrongLast}" → "${m.correctFirst} ${m.correctLast}"`);
        }
      }
    }

    if (action === "fix-agent-names") {
      // Fix truncated multi-word first names
      const fixes = [
        { current: { firstName: "MAY", lastName: "RABAGO" }, correct: { firstName: "MAY CELL", lastName: "RABAGO" } },
        { current: { firstName: "BABY", lastName: "TIMAN" }, correct: { firstName: "BABY JANE", lastName: "TIMAN" } },
        { current: { firstName: "FREDDIE", lastName: "VELASCO" }, correct: { firstName: "FREDDIE JAMES", lastName: "VELASCO" } },
        { current: { firstName: "BRYAN", lastName: "ENTRINA" }, correct: { firstName: "BRYAN JAY", lastName: "ENTRINA" } },
        { current: { firstName: "SHAIRA", lastName: "ENTRINA" }, correct: { firstName: "SHAIRA MAE", lastName: "ENTRINA" } },
        { current: { firstName: "SHARONE", lastName: "ISLA" }, correct: { firstName: "SHARONE RAE", lastName: "ISLA" } },
        { current: { firstName: "MARY", lastName: "BAGUIO" }, correct: { firstName: "MARY ANN", lastName: "BAGUIO" } },
        { current: { firstName: "MARY", lastName: "OLINTAD" }, correct: { firstName: "MARY ANN", lastName: "OLINTAD" } },
        { current: { firstName: "ANDREA", lastName: "CRUZ" }, correct: { firstName: "ANDREA", lastName: "DELA CRUZ" } },
        { current: { firstName: "VINCE", lastName: "CARREON" }, correct: { firstName: "VINCE AERON", lastName: "CARREON" } },
        { current: { firstName: "JERIE", lastName: "ALMEDA" }, correct: { firstName: "JERIE MAY", lastName: "ALMEDA" } },
        { current: { firstName: "KENT", lastName: "MAMANGON" }, correct: { firstName: "KENT JHON", lastName: "MAMANGON" } },
        { current: { firstName: "LLYOD", lastName: "VALENZUELA" }, correct: { firstName: "LLOYD VERNON", lastName: "VALENZUELA" } },
        { current: { firstName: "BETTY", lastName: "PELARCO" }, correct: { firstName: "BETTY C.", lastName: "PELARCO" } },
        { current: { firstName: "RIMARLIE", lastName: "GOLOSINO" }, correct: { firstName: "REMARLIE", lastName: "GOLOSINO" } },
        { current: { firstName: "EMELIA", lastName: "AQUINO" }, correct: { firstName: "EMELIA", lastName: "AQUINO" } },
        { current: { firstName: "VICENTA", lastName: "MARTIN" }, correct: { firstName: "VICENTA", lastName: "MARTIN" } },
        { current: { firstName: "ABDUL", lastName: "L.TANAGUB" }, correct: { firstName: "ABDUL KADIR", lastName: "TANAGUB" } },
      ];

      for (const f of fixes) {
        const emp = await db.employee.findFirst({
          where: { firstName: f.current.firstName, lastName: f.current.lastName },
        });
        if (emp) {
          await db.employee.update({
            where: { id: emp.id },
            data: { firstName: f.correct.firstName, lastName: f.correct.lastName },
          });
          log.push(`Fixed: "${f.current.firstName} ${f.current.lastName}" → "${f.correct.firstName} ${f.correct.lastName}"`);
        }
      }
    }

    if (action === "fix-free-payments") {
      // The importer added FREE to ALL members because the Payment CSV has a "FREE" column
      // with the monthly due amount (420) for members who got free month.
      // But actually only members with "Free one month" / "FREE ONE MONTH" notation should have it.
      //
      // The correct approach: delete ALL free payments, then re-add only for members
      // whose payment CSV row had "Free one month" in the notes columns.
      //
      // Since we can't re-read the CSV here, we'll fix by looking at the payment pattern:
      // A legitimate FREE member has: installment #1 = free (₱0), installment #2 = first paid
      // A non-free member should have: installment #1 = first paid (no free record)
      //
      // The CSV "FREE" column had the monthly due amount (420) for members who had it.
      // The importer created free for everyone because it checked if FREE column > 0.
      // But the FREE column in the payment CSV contains the monthly due for ALL rows.
      //
      // Solution: Delete all free payments, then renumber all installments to start at 1 instead of 2.
      // This is the safest cleanup since we can't distinguish from here.

      // Actually, let's check: in the CSV the FREE column appears BEFORE the month columns.
      // If a member truly had a free month, their first paid month would have started later.
      // The safest fix: delete free payments and renumber all installments (subtract 1 from each).

      const freePayments = await db.payment.findMany({
        where: { isFree: true },
        select: { id: true, memberId: true },
      });

      const affectedMemberIds = [...new Set(freePayments.map(p => p.memberId))];

      // Delete all free payments
      const deleted = await db.payment.deleteMany({ where: { isFree: true } });
      log.push(`Deleted ${deleted.count} incorrect FREE payments`);

      // For each affected member, renumber installments (shift down by 1)
      let renumbered = 0;
      for (const memberId of affectedMemberIds) {
        const payments = await db.payment.findMany({
          where: { memberId },
          orderBy: { installmentNo: "asc" },
        });
        for (const p of payments) {
          if (p.installmentNo > 1) {
            await db.payment.update({
              where: { id: p.id },
              data: { installmentNo: p.installmentNo - 1 },
            });
            renumbered++;
          }
        }
      }
      log.push(`Renumbered ${renumbered} payment installments for ${affectedMemberIds.length} members`);
    }

    if (action === "fix-collector-assignments") {
      // Find MOCTAR TANAGUB — the main collector
      let moctar = await db.employee.findFirst({
        where: { firstName: { contains: "MOCTAR" }, lastName: { contains: "TANAGUB" } },
      });

      if (!moctar) {
        log.push("MOCTAR TANAGUB not found — check if already exists with different spelling");
      } else {
        // Count members that have MOCTAR as collector from the CSV but got assigned differently
        // Members with null collector should get MOCTAR if they were in his CSV collector column
        const noCollector = await db.member.count({ where: { collectorId: null } });
        log.push(`Found ${noCollector} members without collector. MOCTAR TANAGUB id: ${moctar.id}`);

        // Make sure MOCTAR has AO position
        if (moctar.primaryPosition !== "AO") {
          await db.employee.update({
            where: { id: moctar.id },
            data: { primaryPosition: "AO" },
          });
          log.push(`Updated MOCTAR TANAGUB to AO position`);
        }

        // Assign unassigned members to MOCTAR (he's the main collector per CSV)
        if (noCollector > 0) {
          const updated = await db.member.updateMany({
            where: { collectorId: null },
            data: { collectorId: moctar.id },
          });
          log.push(`Assigned ${updated.count} members to MOCTAR TANAGUB as collector`);
        }
      }
    }

    if (action === "summary") {
      const members = await db.member.count();
      const payments = await db.payment.count();
      const employees = await db.employee.count();
      const freePayments = await db.payment.count({ where: { isFree: true } });
      const noAgent = await db.member.count({ where: { agentId: null } });
      const noCollector = await db.member.count({ where: { collectorId: null } });
      const beneficiaries = await db.beneficiary.count();

      const statuses = await db.member.groupBy({ by: ["status"], _count: true });
      const positions = await db.employee.groupBy({ by: ["primaryPosition"], _count: true });

      log.push(`Members: ${members}`);
      log.push(`Payments: ${payments}`);
      log.push(`Free Payments: ${freePayments}`);
      log.push(`Employees: ${employees}`);
      log.push(`Beneficiaries: ${beneficiaries}`);
      log.push(`Members without agent: ${noAgent}`);
      log.push(`Members without collector: ${noCollector}`);
      log.push(`--- Status ---`);
      statuses.forEach(s => log.push(`  ${s.status}: ${s._count}`));
      log.push(`--- Positions ---`);
      positions.forEach(p => log.push(`  ${p.primaryPosition}: ${p._count}`));
    }

    return NextResponse.json({ ok: true, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, log }, { status: 500 });
  }
}
