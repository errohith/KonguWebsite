import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { respondToInterest, withdrawInterest } from "@/server/modules/interests/service";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ action: z.enum(["accept", "decline", "withdraw"]) });

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(req, { active: true });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const { action } = body.parse(await readJson(req));
  if (action === "withdraw") await withdrawInterest(user, id);
  else await respondToInterest(user, id, action === "accept");
  return NextResponse.json({ ok: true });
});
