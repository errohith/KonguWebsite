import { getDb } from "@/server/db/client";

export async function resetDatabase() {
  const db = getDb();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await db.$executeRawUnsafe(`ALTER SEQUENCE "Profile_profileNumber_seq" RESTART WITH 100001`);
  await db.membershipPlan.createMany({
    data: [
      {
        code: "FREE",
        name: "Free",
        price: "0",
        durationDays: 36500,
        interestsPerDay: 2,
        canViewContacts: false,
        contactViewsIncluded: 0,
      },
      {
        code: "GOLD",
        name: "Gold",
        price: "999.00",
        durationDays: 30,
        interestsPerDay: 10,
        canViewContacts: true,
        canViewPremiumOnly: true,
        contactViewsIncluded: 1,
      },
    ],
  });
}
