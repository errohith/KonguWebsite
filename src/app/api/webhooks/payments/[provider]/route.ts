import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/server/http/api";
import { handlePaymentWebhook } from "@/server/modules/payments/service";

/**
 * Payment provider webhooks. Not origin-checked (the provider calls us);
 * authenticity comes from the HMAC signature over the raw body.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const raw = await req.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: { code: "VALIDATION" } }, { status: 413 });
  try {
    const result = await handlePaymentWebhook(provider, raw, req.headers);
    return NextResponse.json({ received: true, status: result.status });
  } catch (err) {
    return errorResponse(err);
  }
}
