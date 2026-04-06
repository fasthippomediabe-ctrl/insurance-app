const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const branches = [
    { name: "Gensan Branch" },
    { name: "Don Carlos Branch" },
    { name: "Lomundao Branch" },
    { name: "Isulan Branch" },
  ];

  for (const b of branches) {
    const existing = await db.branch.findFirst({ where: { name: b.name } });
    if (existing) {
      console.log(`Branch "${b.name}" already exists (id: ${existing.id})`);
    } else {
      const created = await db.branch.create({ data: b });
      console.log(`Created branch "${created.name}" (id: ${created.id})`);
    }
  }

  // List all branches
  const all = await db.branch.findMany({ orderBy: { name: "asc" } });
  console.log("\nAll branches:");
  for (const b of all) {
    console.log(`  ${b.id} — ${b.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
