import { NextResponse } from "next/server";
import { apiHandler } from "@/server/http/api";
import { listActivePlans } from "@/server/modules/membership/plans";
import { paymentsEnabled } from "@/server/modules/payments/service";

export const GET = apiHandler(async () => {
  const plans = await listActivePlans();
  return NextResponse.json({
    paymentsEnabled: paymentsEnabled(),
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      nameTa: p.nameTa,
      description: p.description,
      price: p.price.toFixed(2),
      currency: p.currency,
      durationDays: p.durationDays,
      interestsPerDay: p.interestsPerDay,
      canViewContacts: p.canViewContacts,
      contactViewsIncluded: p.contactViewsIncluded,
      benefits: p.benefits,
    })),
  });
});
