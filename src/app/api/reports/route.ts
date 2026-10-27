import { NextResponse } from "next/server";
import { apiHandler, readJson, requireApiUser } from "@/server/http/api";
import { reportProfile } from "@/server/modules/privacy/service";

export const POST = apiHandler(async (req) => {
  const user = await requireApiUser(req);
  const body = (await readJson(req)) as { publicId?: string; reason?: string; details?: string };
  const report = await reportProfile(user.id, String(body.publicId ?? "").toUpperCase(), body);
  return NextResponse.json({ report: { id: report.id, status: report.status } }, { status: 201 });
});
