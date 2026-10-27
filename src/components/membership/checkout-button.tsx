"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { confirmCheckoutAction, startCheckoutAction } from "@/server/actions/payments";

type CheckoutData = {
  provider: string;
  keyId: string;
  scriptUrl: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  planName: string;
  email: string;
};

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayCtor = new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: () => void): void };

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("checkout script failed to load"));
    document.body.appendChild(s);
  });
}

/**
 * Opens the provider's hosted checkout. Success is shown only after the
 * server has verified the payment signature — never on the client's word.
 */
export function CheckoutButton({ planCode, label, appName }: { planCode: string; label: string; appName: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  function begin() {
    setStatus(null);
    startTransition(async () => {
      const res = await startCheckoutAction(planCode, null);
      if (!res?.ok || !res.data) {
        setStatus({ tone: "error", text: res?.error ?? t("errors.generic") });
        return;
      }
      const data = res.data as unknown as CheckoutData;
      try {
        await loadScript(data.scriptUrl);
      } catch {
        setStatus({ tone: "error", text: t("errors.SERVICE_UNAVAILABLE") });
        return;
      }
      const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Razorpay) {
        setStatus({ tone: "error", text: t("errors.SERVICE_UNAVAILABLE") });
        return;
      }
      const checkout = new Razorpay({
        key: data.keyId,
        amount: data.amountMinor,
        currency: data.currency,
        name: appName,
        description: data.planName,
        order_id: data.orderId,
        prefill: { email: data.email },
        theme: { color: "#7a1f2b" },
        handler: (resp: RazorpayResponse) => {
          setStatus({ tone: "info", text: t("membership.processing") });
          startTransition(async () => {
            const confirmed = await confirmCheckoutAction({
              orderId: resp.razorpay_order_id,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            });
            setStatus(
              confirmed?.ok
                ? { tone: "success", text: t("membership.success") }
                : { tone: "error", text: t("membership.verifyFailed") },
            );
          });
        },
      });
      checkout.on("payment.failed", () => setStatus({ tone: "error", text: t("membership.failed") }));
      checkout.open();
    });
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={begin} disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {label}
      </button>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
    </div>
  );
}
