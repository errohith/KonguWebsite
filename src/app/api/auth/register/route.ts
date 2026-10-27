import { NextResponse } from "next/server";
import { getEnv, isSecureCookie } from "@/server/config/env";
import { apiHandler, clientIp, readJson } from "@/server/http/api";
import { login, register } from "@/server/modules/auth/service";

export const POST = apiHandler(async (req) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const meta = { ip: clientIp(req), userAgent: req.headers.get("user-agent") };
  const { user, verificationEmailSent } = await register(body, meta);
  const session = await login({ email: String(body.email), password: String(body.password) }, meta);
  const res = NextResponse.json({ user: { id: user.id, status: user.status }, verificationEmailSent }, { status: 201 });
  res.cookies.set(getEnv().SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return res;
});
