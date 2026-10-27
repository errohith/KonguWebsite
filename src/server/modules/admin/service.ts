import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentStatus, SubscriptionStatus, type UserRole, type UserStatus } from "@/generated/prisma/enums";
import { formatPublicId, parsePublicId } from "@/lib/options";
import { db } from "@/server/db/client";
import { audit } from "@/server/lib/audit";
import { AppError } from "@/server/lib/errors";
import { revokeAllSessions } from "@/server/modules/auth/sessions";

export async function dashboardStats() {
  const now = new Date();
  const [members, published, activeSubs, revenue, openTickets] = await Promise.all([
    db.user.count({ where: { role: "MEMBER", status: { not: "DELETED" } } }),
    db.profile.count({ where: { status: "PUBLISHED" } }),
    db.subscription.count({ where: { status: "ACTIVE", endsAt: { gt: now } } }),
    db.payment.aggregate({
      where: { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } },
      _sum: { amount: true, amountRefunded: true },
    }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const gross = revenue._sum.amount;
  const refunded = revenue._sum.amountRefunded;
  return {
    members,
    published,
    activeSubs,
    netRevenue: gross ? gross.sub(refunded ?? 0).toFixed(2) : "0.00",
    openTickets,
  };
}

export async function searchMembers(q: string | undefined, page = 1) {
  const query = q?.trim();
  const profileNumber = query ? parsePublicId(query) : null;
  const where: Prisma.UserWhereInput = query
    ? profileNumber !== null
      ? { profile: { profileNumber } }
      : { OR: [{ email: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }] }
    : {};
  const take = 25;
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        profile: { select: { profileNumber: true, displayName: true, status: true, verificationState: true } },
      },
    }),
  ]);
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / take)),
    users: users.map((u) => ({ ...u, publicId: u.profile ? formatPublicId(u.profile.profileNumber) : null })),
  };
}

export async function getMemberDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      gender: true,
      dateOfBirth: true,
      emailVerifiedAt: true,
      createdAt: true,
      lastLoginAt: true,
      deletionScheduledAt: true,
      profile: { include: { photos: { select: { id: true, moderationStatus: true } } } },
      subscriptions: { orderBy: { startsAt: "desc" }, include: { plan: { select: { name: true, code: true } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
      reportsMade: { select: { id: true }, take: 1 },
    },
  });
  if (!user) throw new AppError("NOT_FOUND");
  const reportsAgainst = user.profile ? await db.report.count({ where: { reportedProfileId: user.profile.id } }) : 0;
  return { ...user, publicId: user.profile ? formatPublicId(user.profile.profileNumber) : null, reportsAgainst };
}

export async function setMemberStatus(
  actorUserId: string,
  userId: string,
  status: Extract<UserStatus, "ACTIVE" | "SUSPENDED">,
  reason: string,
) {
  if (actorUserId === userId) throw new AppError("FORBIDDEN");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status === "DELETED") throw new AppError("CONFLICT");
    await tx.user.update({ where: { id: userId }, data: { status } });
    await audit(
      {
        actorUserId,
        action: status === "SUSPENDED" ? "user.suspend" : "user.unsuspend",
        entityType: "User",
        entityId: userId,
        metadata: { reason },
      },
      tx,
    );
  });
  if (status === "SUSPENDED") await revokeAllSessions(userId);
}

export async function setMemberRole(actorUserId: string, userId: string, role: UserRole) {
  if (actorUserId === userId) throw new AppError("FORBIDDEN");
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    await tx.user.update({ where: { id: userId }, data: { role } });
    await audit(
      {
        actorUserId,
        action: "user.role_change",
        entityType: "User",
        entityId: userId,
        metadata: { from: before.role, to: role },
      },
      tx,
    );
  });
  await revokeAllSessions(userId);
}

const isOneOf = <T extends string>(values: Record<string, T>, v: string | undefined): v is T =>
  v !== undefined && (Object.values(values) as string[]).includes(v);

export async function listSubscriptions(status?: string) {
  return db.subscription.findMany({
    where: isOneOf(SubscriptionStatus, status) ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { plan: { select: { name: true } }, user: { select: { email: true } } },
  });
}

export async function listPayments(status?: string) {
  return db.payment.findMany({
    where: isOneOf(PaymentStatus, status) ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { plan: { select: { name: true } }, user: { select: { email: true } }, refunds: true },
  });
}

export async function listAuditLogs(page = 1) {
  const take = 50;
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * take,
    take,
    include: { actor: { select: { email: true } } },
  });
}
