import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "jackpmullen5@gmail.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin1234";
  const name = process.env.ADMIN_NAME ?? "Admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", active: true },
    create: { email, name, role: "ADMIN", passwordHash },
  });

  console.log(`Seeded admin user: ${admin.email} (role: ${admin.role})`);
  console.log(`Login password: ${password}`);

  // A second demo analyst account for testing the multi-user workflow.
  const analystEmail = "analyst@example.com";
  await prisma.user.upsert({
    where: { email: analystEmail },
    update: {},
    create: {
      email: analystEmail,
      name: "Demo Analyst",
      role: "ANALYST",
      passwordHash: await bcrypt.hash("analyst1234", 10),
    },
  });
  console.log(`Seeded analyst user: ${analystEmail} / analyst1234`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
