import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getEnv } from "@/server/config/env";
import { captureException } from "@/server/integrations/error-tracking";
import { AppError, isAppError } from "@/server/lib/errors";
import { validateSessionToken, type SessionUser } from "@/server/modules/auth/sessions";

/** JSON error envelope: { error: { code, message, fields? } } */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[String(i.path[0] ?? "_")] ??= i.message;
    return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid input", fields } }, { status: 400 });
  }
  if (isAppError(err)) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message !== err.code ? err.message : err.code, details: err.details } },
      { status: err.status },
    );
  }
  captureException(err, { where: "api" });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Internal error" } }, { status: 500 });
}

/**
 * CSRF defence for cookie-authenticated API calls: mutating requests must
 * come from APP_URL or a configured CORS origin. (Server Actions get the
 * equivalent check from Next.js.)
 */
export function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const env = getEnv();
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(env.APP_URL).origin, ...env.CORS_ORIGINS]);
  if (!origin || !allowed.has(origin)) throw new AppError("FORBIDDEN", "origin not allowed");
}

export async function getApiUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(getEnv().SESSION_COOKIE_NAME)?.value;
  return (await validateSessionToken(token))?.user ?? null;
}

export async function requireApiUser(req: NextRequest, opts: { active?: boolean } = {}): Promise<SessionUser> {
  const user = await getApiUser(req);
  if (!user) throw new AppError("UNAUTHENTICATED");
  if (opts.active && user.status === "PENDING_VERIFICATION") throw new AppError("EMAIL_NOT_VERIFIED");
  if (opts.active && user.status !== "ACTIVE") throw new AppError("ACCOUNT_INACTIVE");
  return user;
}

/** Wraps a route handler with origin checks and uniform error handling. */
export function apiHandler<C>(handler: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION", "Body must be valid JSON");
  }
}

export function clientIp(req: NextRequest): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
}
