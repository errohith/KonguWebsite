import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { startCheckout } from "@/server/modules/payments/service";

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  const { planCode } = z.object({ planCode: z.string().min(2).max(32) }).parse(await readJson(req));
  return NextResponse.json(await startCheckout(user.id, planCode), { status: 201 });
});
