import { NextResponse } from "next/server";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { confirmCheckout } from "@/server/modules/payments/service";

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(req);
  return NextResponse.json(await confirmCheckout(user.id, await readJson(req)));
});
