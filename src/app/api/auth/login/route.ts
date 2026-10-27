import { NextResponse } from "next/server";
import { getEnv, isSecureCookie } from "@/server/config/env";
import { apiHandler, clientIp, readJson } from "@/server/http/api";
import { login } from "@/server/modules/auth/service";

export const POST = apiHandler(async (req) => {
  const body = (await readJson(req)) as { email?: string; password?: string };
  const session = await login(
    { email: String(body.email ?? ""), password: String(body.password ?? "") },
    { ip: clientIp(req), userAgent: req.headers.get("user-agent") },
  );
  const res = NextResponse.json({ user: session.user });
  res.cookies.set(getEnv().SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return res;
});
