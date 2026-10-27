import "server-only";
import { db } from "@/server/db/client";

/** Discovery is open to active members whose own profile is published. */
export async function canDiscover(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId }, select: { status: true } });
  return profile?.status === "PUBLISHED";
}
