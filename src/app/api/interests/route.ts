import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { listInterests, sendInterest } from "@/server/modules/interests/service";

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  const direction = req.nextUrl.searchParams.get("direction") === "sent" ? "sent" : "received";
  return NextResponse.json({ interests: await listInterests(user, direction) });
});

const body = z.object({ publicId: z.string().min(3).max(20), message: z.string().max(500).optional() });

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  const input = body.parse(await readJson(req));
  const interest = await sendInterest(user, input.publicId.toUpperCase(), input.message);
  return NextResponse.json({ interest: { id: interest.id, status: interest.status } }, { status: 201 });
});
