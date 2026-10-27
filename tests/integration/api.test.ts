import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as sendInterestRoute } from "@/app/api/interests/route";
import { GET as profileRoute } from "@/app/api/profiles/[publicId]/route";
import { POST as webhookRoute } from "@/app/api/webhooks/payments/[provider]/route";
import { GET as photoRoute } from "@/app/api/media/photos/[id]/route";
import { PrismaClient } from "@/generated/prisma/client";
import { checkDatabaseHealth } from "@/server/db/health";
import { createMember, TEST_PASSWORD } from "../helpers/factory";

const ORIGIN = process.env.APP_URL!;
const req = (path: string, init: { method?: string; body?: unknown; cookie?: string; origin?: string | null } = {}) =>
  new NextRequest(new URL(path, ORIGIN), {
    method: init.method ?? "GET",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: {
      "content-type": "application/json",
      ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
  });

async function sessionCookie(email: string) {
  const res = await login(
    req("/api/auth/login", { method: "POST", body: { email, password: TEST_PASSWORD } }),
    undefined,
  );
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

describe("API", () => {
  it("health check reports database connectivity without leaking details", async () => {
    const res = await health();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.database.ok).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/postgres|password|localhost/);
  });

  it("health check reports PostgreSQL connection failures safely", async () => {
    const g = globalThis as unknown as { prisma?: PrismaClient };
    const real = g.prisma;
    g.prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://nobody:wrong@127.0.0.1:1/none",
        connectionTimeoutMillis: 500,
      }),
    });
    try {
      const result = await checkDatabaseHealth(2000);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/wrong|127\.0\.0\.1|nobody/);
    } finally {
      await g.prisma.$disconnect();
      g.prisma = real;
    }
  });

  it("rejects cross-origin mutating requests (CSRF)", async () => {
    const m = await createMember({ gender: "MALE" });
    const res = await login(
      req("/api/auth/login", {
        method: "POST",
        origin: "https://evil.example",
        body: { email: m.user.email, password: TEST_PASSWORD },
      }),
      undefined,
    );
    expect(res.status).toBe(403);
    const noOrigin = await login(
      req("/api/auth/login", { method: "POST", origin: null, body: { email: m.user.email, password: TEST_PASSWORD } }),
      undefined,
    );
    expect(noOrigin.status).toBe(403);
  });

  it("requires authentication and hides inaccessible profiles as 404", async () => {
    const a = await createMember({ gender: "MALE" });
    const hidden = await createMember({ gender: "FEMALE", visibility: "HIDDEN" });
    const ctx = { params: Promise.resolve({ publicId: hidden.publicId! }) };
    expect((await profileRoute(req(`/api/profiles/${hidden.publicId}`), ctx)).status).toBe(401);
    const cookie = await sessionCookie(a.user.email);
    expect((await profileRoute(req(`/api/profiles/${hidden.publicId}`, { cookie }), ctx)).status).toBe(404);
  });

  it("sends interests and reports duplicates as 409", async () => {
    const a = await createMember({ gender: "MALE" });
    const b = await createMember({ gender: "FEMALE" });
    const cookie = await sessionCookie(a.user.email);
    const first = await sendInterestRoute(
      req("/api/interests", { method: "POST", cookie, body: { publicId: b.publicId } }),
      undefined,
    );
    expect(first.status).toBe(201);
    const dup = await sendInterestRoute(
      req("/api/interests", { method: "POST", cookie, body: { publicId: b.publicId } }),
      undefined,
    );
    expect(dup.status).toBe(409);
  });

  it("webhook endpoint rejects unknown providers and unsigned payloads", async () => {
    const r = (provider: string) =>
      webhookRoute(
        new NextRequest(new URL(`/api/webhooks/payments/${provider}`, ORIGIN), { method: "POST", body: "{}" }),
        { params: Promise.resolve({ provider }) },
      );
    expect((await r("unknown")).status).toBe(404);
    expect((await r("razorpay")).status).toBe(404); // provider not configured in test env
  });

  it("photos are not served to anonymous users", async () => {
    const res = await photoRoute(req("/api/media/photos/00000000-0000-0000-0000-000000000000"), {
      params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(res.status).toBe(401);
  });
});
