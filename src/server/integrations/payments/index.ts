import "server-only";
import { getEnv } from "@/server/config/env";
import { AppError } from "@/server/lib/errors";
import { hmacSha256, safeEqual, sha256 } from "@/server/lib/crypto";
import { logger } from "@/server/lib/logger";
import { fetchWithTimeout, joinUrl } from "../http";

/** Provider-neutral webhook event consumed by the payments module. */
export type PaymentWebhookEvent = {
  eventId: string;
  rawType: string;
  type: "payment.captured" | "payment.failed" | "refund.processed" | "ignored";
  orderId?: string;
  paymentId?: string;
  amountMinor?: number;
  currency?: string;
  refundId?: string;
  failureReason?: string;
};

export type CreatedOrder = { orderId: string; amountMinor: number; currency: string };

export type CheckoutConfig = { provider: string; keyId: string; scriptUrl: string };

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: {
    amountMinor: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<CreatedOrder>;
  /** Verifies the signature the browser checkout returns after payment. */
  verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent;
  checkoutConfig(): CheckoutConfig;
}

/**
 * Razorpay adapter.
 * - Orders API: POST /v1/orders with HTTP basic auth (key id / key secret).
 * - Checkout signature: HMAC-SHA256(order_id + "|" + payment_id, key secret).
 * - Webhooks: X-Razorpay-Signature = HMAC-SHA256(raw body, webhook secret);
 *   X-Razorpay-Event-Id identifies the delivery for idempotency.
 * Verify against current Razorpay documentation before enabling in production.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  constructor(
    private readonly cfg: {
      apiBaseUrl: string;
      keyId: string;
      keySecret: string;
      webhookSecret: string;
      checkoutScriptUrl: string;
    },
  ) {}

  async createOrder(input: {
    amountMinor: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<CreatedOrder> {
    const auth = Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString("base64");
    let res: Response;
    try {
      res = await fetchWithTimeout(joinUrl(this.cfg.apiBaseUrl, "/v1/orders"), {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: input.currency,
          receipt: input.receipt.slice(0, 40),
          notes: input.notes,
        }),
      });
    } catch (err) {
      logger.error("payment.create_order_network_error", { provider: this.name, error: err });
      throw new AppError("SERVICE_UNAVAILABLE", "Payment provider unreachable");
    }
    if (!res.ok) {
      logger.error("payment.create_order_failed", { provider: this.name, status: res.status });
      throw new AppError("SERVICE_UNAVAILABLE", "Payment provider rejected the order");
    }
    const body = (await res.json()) as { id?: string; amount?: number; currency?: string };
    if (!body.id || body.amount !== input.amountMinor || body.currency !== input.currency) {
      throw new AppError("SERVICE_UNAVAILABLE", "Unexpected payment provider response");
    }
    return { orderId: body.id, amountMinor: body.amount, currency: body.currency };
  }

  verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }) {
    const expected = hmacSha256(this.cfg.keySecret, `${input.orderId}|${input.paymentId}`);
    return safeEqual(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: string, signature: string | null) {
    if (!signature) return false;
    return safeEqual(hmacSha256(this.cfg.webhookSecret, rawBody), signature);
  }

  parseWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent {
    type Entity = Record<string, unknown>;
    const body = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: Entity }; refund?: { entity?: Entity } };
    };
    const rawType = String(body.event ?? "unknown");
    const eventId = headers.get("x-razorpay-event-id") ?? `sha256:${sha256(rawBody)}`;
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);

    switch (rawType) {
      case "payment.captured":
      case "order.paid":
        return {
          eventId,
          rawType,
          type: "payment.captured",
          orderId: str(payment?.order_id),
          paymentId: str(payment?.id),
          amountMinor: num(payment?.amount),
          currency: str(payment?.currency),
        };
      case "payment.failed":
        return {
          eventId,
          rawType,
          type: "payment.failed",
          orderId: str(payment?.order_id),
          paymentId: str(payment?.id),
          failureReason: str(payment?.error_description),
        };
      case "refund.processed":
        return {
          eventId,
          rawType,
          type: "refund.processed",
          paymentId: str(refund?.payment_id),
          refundId: str(refund?.id),
          amountMinor: num(refund?.amount),
          currency: str(refund?.currency),
        };
      default:
        return { eventId, rawType, type: "ignored" };
    }
  }

  checkoutConfig(): CheckoutConfig {
    return { provider: this.name, keyId: this.cfg.keyId, scriptUrl: this.cfg.checkoutScriptUrl };
  }
}

let override: PaymentProvider | undefined;

/** Returns the configured provider, or null when payments are disabled. */
export function getPaymentProvider(): PaymentProvider | null {
  if (override) return override;
  const env = getEnv();
  if (!env.ENABLE_PAYMENTS || env.PAYMENT_PROVIDER === "disabled") return null;
  return new RazorpayProvider({
    apiBaseUrl: env.PAYMENT_API_BASE_URL!,
    keyId: env.PAYMENT_KEY_ID!,
    keySecret: env.PAYMENT_KEY_SECRET!,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET!,
    checkoutScriptUrl: env.PAYMENT_CHECKOUT_SCRIPT_URL!,
  });
}

/** Provider used to verify webhooks even if new checkouts are switched off. */
export function getWebhookProvider(name: string): PaymentProvider | null {
  if (override?.name === name) return override;
  const env = getEnv();
  if (name !== "razorpay" || env.PAYMENT_PROVIDER !== "razorpay") return null;
  return new RazorpayProvider({
    apiBaseUrl: env.PAYMENT_API_BASE_URL!,
    keyId: env.PAYMENT_KEY_ID!,
    keySecret: env.PAYMENT_KEY_SECRET!,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET!,
    checkoutScriptUrl: env.PAYMENT_CHECKOUT_SCRIPT_URL!,
  });
}

export function setPaymentProviderForTests(provider: PaymentProvider | undefined) {
  override = provider;
}

/** Converts a decimal major-unit amount (e.g. "999.00") to integer minor units. */
export function toMinorUnits(amount: string | number | { toString(): string }): number {
  const [whole, frac = ""] = amount.toString().split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2)) * (whole.startsWith("-") ? -1 : 1);
}
