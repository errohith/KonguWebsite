import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { RazorpayProvider, setPaymentProviderForTests } from "@/server/integrations/payments";
import { getEntitlements } from "@/server/modules/membership/entitlements";
import {
  confirmCheckout,
  expireSubscriptions,
  handlePaymentWebhook,
  recordRefund,
  startCheckout,
} from "@/server/modules/payments/service";
import { createMember } from "../helpers/factory";

const db = getDb();
const cfg = {
  apiBaseUrl: "https://payments.test.invalid",
  keyId: "key_test",
  keySecret: "secret_test",
  webhookSecret: "whsec_test",
  checkoutScriptUrl: "https://checkout.test.invalid/v1.js",
};
const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");
let orderSeq = 0;

function webhook(event: object, eventId: string, secret = cfg.webhookSecret) {
  const body = JSON.stringify(event);
  return handlePaymentWebhook(
    "razorpay",
    body,
    new Headers({ "x-razorpay-signature": sign(secret, body), "x-razorpay-event-id": eventId }),
  );
}
const captured = (orderId: string, paymentId: string, amount = 99900) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, currency: "INR" } } },
});

describe("payments when disabled", () => {
  it("refuses checkout instead of pretending", async () => {
    const m = await createMember({ gender: "MALE" });
    await expect(startCheckout(m.user.id, "GOLD")).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
  });
});

describe("payments with a provider", () => {
  beforeAll(() => {
    setPaymentProviderForTests(new RazorpayProvider(cfg));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({ id: `order_${++orderSeq}`, amount: body.amount, currency: body.currency }),
          { status: 200 },
        );
      }),
    );
  });
  afterAll(() => {
    setPaymentProviderForTests(undefined);
    vi.unstubAllGlobals();
  });

  it("creates a local payment and provider order for the plan's server-side price", async () => {
    const m = await createMember({ gender: "MALE" });
    const checkout = await startCheckout(m.user.id, "GOLD");
    expect(checkout.amountMinor).toBe(99900);
    const payment = await db.payment.findUniqueOrThrow({ where: { providerOrderId: checkout.orderId } });
    expect(payment.status).toBe("CREATED");
    expect(payment.amount.toFixed(2)).toBe("999.00");
    await expect(startCheckout(m.user.id, "FREE")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects forged checkout confirmations and confirmations for other users", async () => {
    const m = await createMember({ gender: "MALE" });
    const other = await createMember({ gender: "FEMALE" });
    const { orderId } = await startCheckout(m.user.id, "GOLD");
    await expect(
      confirmCheckout(m.user.id, { orderId, paymentId: "pay_x", signature: "forged" }),
    ).rejects.toMatchObject({ code: "PAYMENT_VERIFICATION_FAILED" });
    await expect(
      confirmCheckout(other.user.id, {
        orderId,
        paymentId: "pay_x",
        signature: sign(cfg.keySecret, `${orderId}|pay_x`),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getEntitlements(m.user.id)).isPremium).toBe(false);
  });

  it("activates exactly one subscription across browser confirm + duplicate webhooks", async () => {
    const m = await createMember({ gender: "MALE" });
    const { orderId } = await startCheckout(m.user.id, "GOLD");
    const r1 = await confirmCheckout(m.user.id, {
      orderId,
      paymentId: "pay_ok",
      signature: sign(cfg.keySecret, `${orderId}|pay_ok`),
    });
    expect(r1.activated).toBe(true);
    const w1 = await webhook(captured(orderId, "pay_ok"), `evt_${orderId}`);
    const w2 = await webhook(captured(orderId, "pay_ok"), `evt_${orderId}`);
    expect(w1.status).toBe("processed");
    expect(w2.status).toBe("duplicate");
    expect(await db.subscription.count({ where: { userId: m.user.id } })).toBe(1);
    const ent = await getEntitlements(m.user.id);
    expect(ent).toMatchObject({ isPremium: true, planCode: "GOLD", canViewContacts: true, interestsPerDay: 10 });
  });

  it("rejects webhooks with forged signatures and records nothing", async () => {
    const m = await createMember({ gender: "MALE" });
    const { orderId } = await startCheckout(m.user.id, "GOLD");
    await expect(webhook(captured(orderId, "pay_f"), "evt_forged", "attacker-secret")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await db.webhookEvent.count({ where: { eventId: "evt_forged" } })).toBe(0);
    expect((await db.payment.findUniqueOrThrow({ where: { providerOrderId: orderId } })).status).toBe("CREATED");
  });

  it("refuses captures whose amount differs from the order, and allows retry later", async () => {
    const m = await createMember({ gender: "MALE" });
    const { orderId } = await startCheckout(m.user.id, "GOLD");
    await expect(webhook(captured(orderId, "pay_m", 100), "evt_mismatch")).rejects.toMatchObject({
      code: "PAYMENT_VERIFICATION_FAILED",
    });
    expect((await db.webhookEvent.findFirstOrThrow({ where: { eventId: "evt_mismatch" } })).status).toBe("FAILED");
    expect((await getEntitlements(m.user.id)).isPremium).toBe(false);
  });

  it("records refunds idempotently and revokes the plan on full refund", async () => {
    const m = await createMember({ gender: "MALE" });
    const { orderId } = await startCheckout(m.user.id, "GOLD");
    await webhook(captured(orderId, "pay_r"), `evt_cap_${orderId}`);
    const refundEvent = {
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_r", amount: 99900, currency: "INR" } } },
    };
    await webhook(refundEvent, "evt_refund_1");
    await webhook(refundEvent, "evt_refund_1_redelivery");
    const payment = await db.payment.findUniqueOrThrow({
      where: { providerOrderId: orderId },
      include: { refunds: true },
    });
    expect(payment.status).toBe("REFUNDED");
    expect(payment.refunds).toHaveLength(1);
    expect((await getEntitlements(m.user.id)).isPremium).toBe(false);
    await expect(recordRefund(null, payment.id, { amount: "1.00" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("expires lapsed subscriptions", async () => {
    const m = await createMember({ gender: "MALE" });
    const { orderId } = await startCheckout(m.user.id, "GOLD");
    await webhook(captured(orderId, "pay_e"), `evt_exp_${orderId}`);
    await db.subscription.updateMany({
      where: { userId: m.user.id },
      data: { startsAt: new Date(Date.now() - 3 * 86_400_000), endsAt: new Date(Date.now() - 1000) },
    });
    expect(await expireSubscriptions()).toBeGreaterThanOrEqual(1);
    expect((await db.subscription.findFirstOrThrow({ where: { userId: m.user.id } })).status).toBe("EXPIRED");
  });
});
