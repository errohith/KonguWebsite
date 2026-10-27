import { NextResponse } from "next/server";
import { apiHandler, requireApiUser } from "@/server/http/api";
import { revealContact } from "@/server/modules/profiles/service";

type Ctx = { params: Promise<{ publicId: string }> };

/** Unlocks contact details (consumes one contact view the first time). */
export const POST = apiHandler<Ctx>(async (req, ctx) => {
  const user = await requireApiUser(req, { active: true });
  const { publicId } = await ctx.params;
  return NextResponse.json({ contact: await revealContact(user, publicId.toUpperCase()) });
});
