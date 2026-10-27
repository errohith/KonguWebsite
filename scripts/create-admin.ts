/**
 * Creates or promotes an administrator. Safe for staging/production.
 * Credentials come from the process environment (never from a committed file):
 *
 *   ADMIN_EMAIL=ops@yourdomain ADMIN_PASSWORD='…' ADMIN_ROLE=SUPER_ADMIN npm run admin:create
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadEnvFile } from "./lib/load-env";

loadEnvFile();

const ROLES = ["SUPPORT", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const role = (process.env.ADMIN_ROLE ?? "ADMIN") as (typeof ROLES)[number];
  if (!email || !ROLES.includes(role))
    throw new Error("Set ADMIN_EMAIL and ADMIN_ROLE (SUPPORT|MODERATOR|ADMIN|SUPER_ADMIN)");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters with letters and numbers");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      dateOfBirth: new Date("1980-01-01T00:00:00Z"),
      gender: "MALE",
    },
    update: { role, status: "ACTIVE" },
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: null,
      action: "user.role_change",
      entityType: "User",
      entityId: user.id,
      metadata: { to: role, via: "create-admin script" },
    },
  });
  console.log(`Administrator ready: ${email} (${role})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
