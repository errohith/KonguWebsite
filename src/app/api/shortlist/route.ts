import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { addToShortlist, listShortlist, removeFromShortlist } from "@/server/modules/interests/service";

const body = z.object({ publicId: z.string().min(3).max(20) });

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  return NextResponse.json({ items: await listShortlist(user) });
});

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  await addToShortlist(user, body.parse(await readJson(req)).publicId.toUpperCase());
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  await removeFromShortlist(user, body.parse(await readJson(req)).publicId.toUpperCase());
  return new NextResponse(null, { status: 204 });
});
