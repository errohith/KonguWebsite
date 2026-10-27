import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db/client";
import {
  getPaymentProvider,
  getWebhookProvider,
  toMinorUnits,
  type PaymentWebhookEvent,
} from "@/server/integrations/payments";
import { audit } from "@/server/lib/audit";
import { sha256 } from "@/server/lib/crypto";
import { addDays } from "@/server/lib/dates";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { enforceRateLimit } from "@/server/lib/rate-limit";
import { emailBestEffort, notify } from "@/server/modules/notifications/service";

export function paymentsEnabled(): boolean {
  return getPaymentProvider() !== null;
}

/** Step 1: create a local CREATED payment and a provider order for the browser checkout. */
export async function startCheckout(userId: string, planCode: string) {
  const provider = getPaymentProvider();
  if (!provider) throw new AppError("FEATURE_DISABLED", "errors.paymentsDisabled");
  await enforceRateLimit(`checkout:${userId}`, 10, 3600);

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, email: true } });
  if (user.status !== "ACTIVE") throw new AppError("ACCOUNT_INACTIVE");
  const plan = await db.membershipPlan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.isActive || plan.price.lte(0)) throw new AppError("NOT_FOUND");

  const payment = await db.payment.create({
    data: { userId, planId: plan.id, provider: provider.name, amount: plan.price, currency: plan.currency },
  });
  try {
    const order = await provider.createOrder({
      amountMinor: toMinorUnits(plan.price.toString()),
      currency: plan.currency,
      receipt: payment.id.replaceAll("-", "").slice(0, 32),
      notes: { paymentId: payment.id, planCode: plan.code },
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerOrderId: order.orderId } });
    return {
      ...provider.checkoutConfig(),
      paymentId: payment.id,
      orderId: order.orderId,
      amountMinor: order.amountMinor,
      currency: order.currency,
      planName: plan.name,
      email: user.email,
    };
  } catch (err) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "order_creation_failed" },
    });
    throw err;
  }
}

export const confirmSchema = z.object({
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(256),
});

/** Step 2 (browser return): verify the provider's signature, then capture idempotently. */
export async function confirmCheckout(userId: string, raw: unknown) {
  const input = confirmSchema.parse(raw);
  const payment = await db.payment.findUnique({ where: { providerOrderId: input.orderId } });
  if (!payment || payment.userId !== userId) throw new AppError("NOT_FOUND");
  const provider = getWebhookProvider(payment.provider);
  if (!provider) throw new AppError("SERVICE_UNAVAILABLE");
  if (!provider.verifyCheckoutSignature(input)) {
    logger.warn("payment.checkout_signature_invalid", { paymentId: payment.id });
    throw new AppError("PAYMENT_VERIFICATION_FAILED");
  }
  return capturePayment(payment.id, input.paymentId);
}

/**
 * Marks a payment CAPTURED and activates exactly one subscription.
 * Safe to call any number of times (browser return + webhooks): the
 * conditional update and the unique Subscription.paymentId guarantee
 * a single activation.
 */
export async function capturePayment(
  paymentId: string,
  providerPaymentId: string,
  check?: { amountMinor?: number; currency?: string },
) {
  const result = await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { plan: true } });
    if (check?.amountMinor !== undefined && check.amountMinor !== toMinorUnits(payment.amount.toString())) {
      throw new AppError("PAYMENT_VERIFICATION_FAILED", "amount mismatch");
    }
    if (check?.currency && check.currency !== payment.currency) {
      throw new AppError("PAYMENT_VERIFICATION_FAILED", "currency mismatch");
    }
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ["CREATED", "FAILED"] } },
      data: { status: "CAPTURED", providerPaymentId, capturedAt: new Date(), failureReason: null },
    });
    if (count === 0) {
      const existing = await tx.subscription.findUnique({ where: { paymentId } });
      return { activated: false, subscription: existing, payment };
    }
    const subscription = await activateSubscription(
      tx,
      payment.userId,
      payment.planId,
      payment.plan.durationDays,
      paymentId,
    );
    await notify(
      {
        userId: payment.userId,
        type: "SUBSCRIPTION_ACTIVATED",
        title: `${payment.plan.name} membership activated`,
        link: "/membership/history",
      },
      tx,
    );
    return { activated: true, subscription, payment };
  });

  if (result.activated && result.subscription) {
    const user = await db.user.findUnique({
      where: { id: result.payment.userId },
      select: { email: true, locale: true },
    });
    if (user) {
      await emailBestEffort(user.email, user.locale, "subscriptionActivated", {
        plan: result.payment.plan.name,
        endsAt: result.subscription.endsAt.toISOString().slice(0, 10),
      });
    }
  }
  return { activated: result.activated, subscriptionId: result.subscription?.id ?? null };
}

/** New paid periods start after any current active period (no lost days). */
async function activateSubscription(
  tx: Tx,
  userId: string,
  planId: string,
  durationDays: number,
  paymentId: string | null,
) {
  const now = new Date();
  const current = await tx.subscription.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
  });
  const startsAt = current ? current.endsAt : now;
  return tx.subscription.create({
    data: { userId, planId, paymentId, startsAt, endsAt: addDays(startsAt, durationDays) },
  });
}

/**
 * Webhook entry point. Verifies the signature over the raw body, records the
 * event id (idempotency), then applies it. Returns a status for logging; the
 * route always answers 2xx for verified events so the provider stops retrying.
 */
export async function handlePaymentWebhook(providerName: string, rawBody: string, headers: Headers) {
  const provider = getWebhookProvider(providerName);
  if (!provider) throw new AppError("NOT_FOUND");
  const signature = headers.get("x-razorpay-signature");
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    logger.warn("payment.webhook_signature_invalid", { provider: providerName });
    throw new AppError("FORBIDDEN", "invalid signature");
  }

  let event: PaymentWebhookEvent;
  try {
    event = provider.parseWebhook(rawBody, headers);
  } catch {
    throw new AppError("VALIDATION", "malformed payload");
  }

  let record;
  try {
    record = await db.webhookEvent.create({
      data: { provider: providerName, eventId: event.eventId, eventType: event.rawType, payloadHash: sha256(rawBody) },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    // Already seen. Only a previously FAILED event is re-claimed for a retry;
    // processed/ignored/in-flight deliveries are acknowledged as duplicates.
    const existing = await db.webhookEvent.findUniqueOrThrow({
      where: { provider_eventId: { provider: providerName, eventId: event.eventId } },
    });
    const { count } = await db.webhookEvent.updateMany({
      where: { id: existing.id, status: "FAILED" },
      data: { status: "RECEIVED", error: null },
    });
    if (count === 0) return { status: "duplicate" as const };
    record = existing;
  }

  try {
    const outcome = await applyWebhookEvent(providerName, event);
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { status: outcome === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date() },
    });
    return { status: outcome };
  } catch (err) {
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : "error" },
    });
    logger.error("payment.webhook_processing_failed", { provider: providerName, eventId: event.eventId, error: err });
    throw err;
  }
}

async function applyWebhookEvent(providerName: string, event: PaymentWebhookEvent): Promise<"processed" | "ignored"> {
  switch (event.type) {
    case "payment.captured": {
      if (!event.orderId || !event.paymentId) return "ignored";
      const payment = await db.payment.findUnique({ where: { providerOrderId: event.orderId } });
      if (!payment || payment.provider !== providerName) return "ignored";
      await capturePayment(payment.id, event.paymentId, { amountMinor: event.amountMinor, currency: event.currency });
      return "processed";
    }
    case "payment.failed": {
      if (!event.orderId) return "ignored";
      await db.payment.updateMany({
        where: { providerOrderId: event.orderId, status: "CREATED" },
        data: { status: "FAILED", failureReason: event.failureReason?.slice(0, 300) ?? "failed" },
      });
      return "processed";
    }
    case "refund.processed": {
      if (!event.paymentId || !event.refundId || event.amountMinor === undefined) return "ignored";
      const payment = await db.payment.findUnique({ where: { providerPaymentId: event.paymentId } });
      if (!payment) return "ignored";
      await recordRefund(null, payment.id, {
        amount: (event.amountMinor / 100).toFixed(2),
        providerRefundId: event.refundId,
        status: "PROCESSED",
        reason: "provider refund",
      });
      return "processed";
    }
    default:
      return "ignored";
  }
}

export const refundSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "errors.invalidAmount"),
  providerRefundId: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || null),
  status: z.enum(["PENDING", "PROCESSED", "FAILED"]).default("PROCESSED"),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

/**
 * Records a refund (from a webhook or manually by an administrator during
 * reconciliation). Idempotent on providerRefundId. A full refund revokes the
 * subscription bought with the payment.
 */
export async function recordRefund(actorUserId: string | null, paymentId: string, raw: z.input<typeof refundSchema>) {
  const input = refundSchema.parse(raw);
  return db.$transaction(async (tx) => {
    if (input.providerRefundId) {
      const existing = await tx.refund.findUnique({ where: { providerRefundId: input.providerRefundId } });
      if (existing) return existing;
    }
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (!["CAPTURED", "PARTIALLY_REFUNDED"].includes(payment.status))
      throw new AppError("CONFLICT", "errors.paymentNotRefundable");
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new AppError("VALIDATION", "errors.invalidAmount");
    const refund = await tx.refund.create({
      data: {
        paymentId,
        amount,
        providerRefundId: input.providerRefundId,
        status: input.status,
        reason: input.reason,
        recordedById: actorUserId,
      },
    });
    if (input.status === "PROCESSED") {
      const refunded = payment.amountRefunded.add(amount);
      if (refunded.gt(payment.amount)) throw new AppError("VALIDATION", "errors.refundExceedsPayment");
      const full = refunded.eq(payment.amount);
      await tx.payment.update({
        where: { id: paymentId },
        data: { amountRefunded: refunded, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      if (full) {
        await tx.subscription.updateMany({
          where: { paymentId, status: "ACTIVE" },
          data: { status: "REFUNDED", cancelledAt: new Date(), cancelReason: "refunded" },
        });
      }
    }
    await audit(
      {
        actorUserId,
        action: "payment.refund",
        entityType: "Payment",
        entityId: paymentId,
        metadata: { amount: input.amount, status: input.status },
      },
      tx,
    );
    return refund;
  });
}

export async function cancelSubscription(actorUserId: string, subscriptionId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const { count } = await tx.subscription.updateMany({
      where: { id: subscriptionId, status: "ACTIVE" },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason.slice(0, 300) || "cancelled by admin",
      },
    });
    if (count !== 1) throw new AppError("CONFLICT");
    await audit(
      {
        actorUserId,
        action: "subscription.cancel",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: { reason },
      },
      tx,
    );
  });
}

/** Complimentary membership granted by an administrator (no payment). */
export async function grantSubscription(actorUserId: string, userId: string, planCode: string) {
  return db.$transaction(async (tx) => {
    const plan = await tx.membershipPlan.findUnique({ where: { code: planCode } });
    if (!plan) throw new AppError("NOT_FOUND");
    const sub = await activateSubscription(tx, userId, plan.id, plan.durationDays, null);
    await audit(
      {
        actorUserId,
        action: "subscription.grant",
        entityType: "Subscription",
        entityId: sub.id,
        metadata: { userId, planCode },
      },
      tx,
    );
    return sub;
  });
}

/** Maintenance job: mark lapsed subscriptions EXPIRED (entitlements already ignore them). */
export async function expireSubscriptions(now = new Date()) {
  const { count } = await db.subscription.updateMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return count;
}

export async function listPaymentsForUser(userId: string) {
  return db.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true, code: true } }, refunds: true },
  });
}

export async function listSubscriptionsForUser(userId: string) {
  return db.subscription.findMany({
    where: { userId },
    orderBy: { startsAt: "desc" },
    include: { plan: { select: { name: true, code: true } } },
  });
}

/** Reconciliation view for administrators. */
export async function reconciliationReport() {
  const staleBefore = new Date(Date.now() - 60 * 60_000);
  const [stale, capturedWithoutSub, failedWebhooks] = await Promise.all([
    db.payment.findMany({
      where: { status: "CREATED", createdAt: { lt: staleBefore } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.payment.findMany({ where: { status: "CAPTURED", subscription: null }, take: 50 }),
    db.webhookEvent.findMany({ where: { status: "FAILED" }, orderBy: { receivedAt: "desc" }, take: 50 }),
  ]);
  return { stale, capturedWithoutSub, failedWebhooks };
}
