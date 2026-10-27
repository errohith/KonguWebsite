import "server-only";
import type { NotificationType } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db/client";
import { logger } from "@/server/lib/logger";
import { sendTemplatedEmail } from "./email";

export async function notify(
  input: { userId: string; type: NotificationType; title: string; body?: string; link?: string },
  tx: Tx = db,
) {
  await tx.notification.create({ data: input });
}

/** Best-effort email: failure is logged, never surfaced as a false success or a crash. */
export async function emailBestEffort(...args: Parameters<typeof sendTemplatedEmail>) {
  try {
    await sendTemplatedEmail(...args);
    return true;
  } catch (err) {
    logger.warn("notifications.email_failed", { template: args[2], error: err });
    return false;
  }
}

export async function listNotifications(userId: string, take = 50) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
