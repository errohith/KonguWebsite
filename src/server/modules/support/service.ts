import "server-only";
import { z } from "zod";
import { TICKET_CATEGORIES } from "@/lib/options";
import { getEnv } from "@/server/config/env";
import { db } from "@/server/db/client";
import { audit } from "@/server/lib/audit";
import { AppError } from "@/server/lib/errors";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { emailBestEffort, notify } from "@/server/modules/notifications/service";

export const ticketSchema = z.object({
  name: z.string().trim().min(2, "errors.required").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("errors.invalidEmail")),
  subject: z.string().trim().min(3, "errors.required").max(150),
  category: z.enum(TICKET_CATEGORIES).default("OTHER"),
  message: z.string().trim().min(10, "errors.messageTooShort").max(5000),
});

export async function createTicket(raw: unknown, meta: { userId?: string; ip?: string }) {
  const input = ticketSchema.parse(raw);
  await enforceRateLimit(`ticket:${meta.userId ?? meta.ip ?? "anon"}`, 5, 3600);
  return db.supportTicket.create({
    data: {
      requesterId: meta.userId ?? null,
      name: input.name,
      email: input.email,
      subject: input.subject,
      category: input.category,
      messages: { create: { authorId: meta.userId ?? null, body: input.message } },
    },
  });
}

export async function listOwnTickets(userId: string) {
  return db.supportTicket.findMany({ where: { requesterId: userId }, orderBy: { updatedAt: "desc" } });
}

export async function getTicketForUser(userId: string, ticketId: string, staff: boolean) {
  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" } }, assignedTo: { select: { email: true } } },
  });
  if (!ticket || (!staff && ticket.requesterId !== userId)) throw new AppError("NOT_FOUND");
  return ticket;
}

const replySchema = z.string().trim().min(1, "errors.required").max(5000);

export async function replyToTicket(userId: string, ticketId: string, rawBody: string, staff: boolean) {
  const body = replySchema.parse(rawBody);
  const ticket = await getTicketForUser(userId, ticketId, staff);
  if (ticket.status === "CLOSED") throw new AppError("CONFLICT", "errors.ticketClosed");
  await db.$transaction(async (tx) => {
    await tx.supportTicketMessage.create({ data: { ticketId, authorId: userId, isStaff: staff, body } });
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: staff ? "IN_PROGRESS" : "OPEN",
        ...(staff && !ticket.assignedToId ? { assignedToId: userId } : {}),
      },
    });
    if (staff && ticket.requesterId) {
      await notify(
        {
          userId: ticket.requesterId,
          type: "SUPPORT_REPLY",
          title: `Reply: ${ticket.subject}`,
          link: `/support/${ticketId}`,
        },
        tx,
      );
    }
    if (staff)
      await audit({ actorUserId: userId, action: "ticket.reply", entityType: "SupportTicket", entityId: ticketId }, tx);
  });
  if (staff) {
    const locale = ticket.requesterId
      ? ((await db.user.findUnique({ where: { id: ticket.requesterId }, select: { locale: true } }))?.locale ?? "en")
      : "en";
    await emailBestEffort(ticket.email, locale, "supportReply", {
      subject: ticket.subject,
      body,
      url: ticket.requesterId ? `${getEnv().APP_URL}/support/${ticketId}` : getEnv().APP_URL,
    });
  }
}

export async function listTicketsForStaff(status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") {
  return db.supportTicket.findMany({
    where: status ? { status } : { status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: { updatedAt: "asc" },
    take: 100,
    include: { assignedTo: { select: { email: true } } },
  });
}

export async function setTicketStatus(
  actorUserId: string,
  ticketId: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
) {
  await db.$transaction(async (tx) => {
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await audit(
      { actorUserId, action: "ticket.status", entityType: "SupportTicket", entityId: ticketId, metadata: { status } },
      tx,
    );
  });
}
