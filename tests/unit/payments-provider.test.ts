import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RazorpayProvider, toMinorUnits } from "@/server/integrations/payments";

const cfg = {
  apiBaseUrl: "https://payments.test.invalid",
  keyId: "key_test",
  keySecret: "secret_test",
  webhookSecret: "whsec_test",
  checkoutScriptUrl: "https://checkout.test.invalid/v1.js",
};
const p = new RazorpayProvider(cfg);
const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

afterEach(() => vi.unstubAllGlobals());

describe("Razorpay adapter", () => {
  it("verifies genuine checkout signatures and rejects forged ones", () => {
    const signature = sign(cfg.keySecret, "order_1|pay_1");
    expect(p.verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature })).toBe(true);
    expect(p.verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_2", signature })).toBe(false);
    expect(p.verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: "00" })).toBe(false);
  });
  it("verifies webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(p.verifyWebhookSignature(body, sign(cfg.webhookSecret, body))).toBe(true);
    expect(p.verifyWebhookSignature(body + " ", sign(cfg.webhookSecret, body))).toBe(false);
    expect(p.verifyWebhookSignature(body, sign("wrong", body))).toBe(false);
    expect(p.verifyWebhookSignature(body, null)).toBe(false);
  });
  it("normalises captured, failed and refund events", () => {
    const h = new Headers({ "x-razorpay-event-id": "evt_1" });
    const captured = p.parseWebhook(
      JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 99900, currency: "INR" } } },
      }),
      h,
    );
    expect(captured).toMatchObject({
      eventId: "evt_1",
      type: "payment.captured",
      orderId: "order_1",
      paymentId: "pay_1",
      amountMinor: 99900,
    });
    const refund = p.parseWebhook(
      JSON.stringify({
        event: "refund.processed",
        payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 100 } } },
      }),
      h,
    );
    expect(refund).toMatchObject({ type: "refund.processed", refundId: "rfnd_1", amountMinor: 100 });
    expect(p.parseWebhook(JSON.stringify({ event: "something.else" }), new Headers()).type).toBe("ignored");
  });
  it("derives a stable event id when the header is missing", () => {
    const body = JSON.stringify({ event: "payment.failed" });
    expect(p.parseWebhook(body, new Headers()).eventId).toBe(p.parseWebhook(body, new Headers()).eventId);
  });
  it("creates orders and treats provider errors as unavailable (never success)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: "order_9", amount: 99900, currency: "INR" }), { status: 200 }),
        ),
    );
    await expect(p.createOrder({ amountMinor: 99900, currency: "INR", receipt: "r" })).resolves.toEqual({
      orderId: "order_9",
      amountMinor: 99900,
      currency: "INR",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    await expect(p.createOrder({ amountMinor: 99900, currency: "INR", receipt: "r" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(p.createOrder({ amountMinor: 99900, currency: "INR", receipt: "r" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: "order_9", amount: 1, currency: "INR" }), { status: 200 }),
        ),
    );
    await expect(p.createOrder({ amountMinor: 99900, currency: "INR", receipt: "r" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
  it("converts decimal amounts to minor units without float error", () => {
    expect(toMinorUnits("999.00")).toBe(99900);
    expect(toMinorUnits("0.1")).toBe(10);
    expect(toMinorUnits("2499.99")).toBe(249999);
    expect(toMinorUnits(19.9)).toBe(1990);
  });
});
