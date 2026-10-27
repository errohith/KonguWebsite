import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { blockProfile, listBlocked } from "@/server/modules/privacy/service";

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(req);
  return NextResponse.json({ blocks: await listBlocked(user.id) });
});

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(req);
  const { publicId } = z.object({ publicId: z.string().min(3).max(20) }).parse(await readJson(req));
  await blockProfile(user.id, publicId.toUpperCase());
  return NextResponse.json({ ok: true }, { status: 201 });
});
