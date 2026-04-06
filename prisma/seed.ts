import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const existing = await db.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const hashed = await bcrypt.hash("admin123", 12);
    await db.user.create({
      data: {
        username: "admin",
        password: hashed,
        role: "ADMIN",
      },
    });
    console.log("Admin user created: admin / admin123");
    console.log("IMPORTANT: Change the admin password after first login!");
  } else {
    console.log("Admin user already exists, skipping.");
  }

  // Create Kidapawan branch (sample)
  const branch = await db.branch.upsert({
    where: { name: "Kidapawan Branch" },
    update: {},
    create: { name: "Kidapawan Branch", address: "Kidapawan City, North Cotabato" },
  });
  console.log(`Branch ready: ${branch.name}`);

  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
