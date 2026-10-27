import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";
import { apiHandler } from "@/server/http/api";
import { revokeSessionToken } from "@/server/modules/auth/sessions";

export const POST = apiHandler(async (req) => {
  const name = getEnv().SESSION_COOKIE_NAME;
  const token = req.cookies.get(name)?.value;
  if (token) await revokeSessionToken(token);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(name);
  return res;
});
