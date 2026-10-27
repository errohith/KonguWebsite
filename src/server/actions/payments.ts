"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/http/action";
import { assertActionUser } from "@/server/modules/auth/current";
import { confirmCheckout, startCheckout } from "@/server/modules/payments/service";

export async function startCheckoutAction(planCode: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser({ active: true });
    const checkout = await startCheckout(user.id, planCode);
    return { data: checkout };
  });
}

export async function confirmCheckoutAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertActionUser();
    await confirmCheckout(user.id, input);
    return "membership.success";
  });
}
