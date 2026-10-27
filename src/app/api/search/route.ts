import { NextResponse } from "next/server";
import { apiHandler, requireApiUser } from "@/server/http/api";
import { AppError } from "@/server/lib/errors";
import { canDiscover } from "@/server/modules/discovery/guard";
import { searchProfiles } from "@/server/modules/discovery/service";

export const GET = apiHandler(async (req) => {
  const user = await requireApiUser(req, { active: true });
  if (!(await canDiscover(user.id))) throw new AppError("FORBIDDEN", "errors.publishProfileFirst");
  const sp = req.nextUrl.searchParams;
  const input: Record<string, string | string[]> = {};
  for (const key of new Set(sp.keys())) {
    const all = sp.getAll(key);
    input[key] = ["maritalStatus", "education", "employment"].includes(key) ? all : all[0];
  }
  return NextResponse.json(await searchProfiles(user, input));
});
