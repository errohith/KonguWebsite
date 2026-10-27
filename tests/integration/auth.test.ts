import { afterEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { setEmailProviderForTests, type EmailMessage } from "@/server/integrations/email";
import * as auth from "@/server/modules/auth/service";
import { validateSessionToken } from "@/server/modules/auth/sessions";

const db = getDb();
const sent: EmailMessage[] = [];
setEmailProviderForTests({ name: "capture", send: async (m) => void sent.push(m) });
afterEach(() => void sent.splice(0));

const yearsAgo = (y: number) => {
  const d = new Date();
  return `${d.getUTCFullYear() - y}-01-01`;
};
const registration = (over: Record<string, unknown> = {}) => ({
  email: `user${Math.random().toString(36).slice(2)}@example.invalid`,
  password: "Password123",
  dateOfBirth: yearsAgo(25),
  gender: "FEMALE",
  acceptTerms: true,
  ...over,
});

describe("registration & adult eligibility", () => {
  it("rejects men under 21 and women under 18", async () => {
    await expect(auth.register(registration({ gender: "MALE", dateOfBirth: yearsAgo(20) }))).rejects.toMatchObject({
      code: "UNDERAGE",
    });
    const d = new Date();
    const seventeen = `${d.getUTCFullYear() - 17}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    await expect(auth.register(registration({ gender: "FEMALE", dateOfBirth: seventeen }))).rejects.toMatchObject({
      code: "UNDERAGE",
    });
  });

  it("requires accepting the terms and a strong password", async () => {
    await expect(auth.register(registration({ acceptTerms: false }))).rejects.toThrow();
    await expect(auth.register(registration({ password: "short1" }))).rejects.toThrow();
    await expect(auth.register(registration({ password: "onlyletterslong" }))).rejects.toThrow();
  });

  it("registers pending verification, emails a link and verifies once", async () => {
    const input = registration();
    const { user, verificationEmailSent } = await auth.register(input);
    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(verificationEmailSent).toBe(true);
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toContain("Password123");
    const token = new URL(/https?:\/\/\S+/.exec(sent[0].text)![0]).searchParams.get("token")!;
    await auth.verifyEmail(token);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("ACTIVE");
    await expect(auth.verifyEmail(token)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects duplicate emails case-insensitively", async () => {
    const input = registration();
    await auth.register(input);
    await expect(auth.register({ ...input, email: input.email.toUpperCase() })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("still registers when the email provider fails, without claiming the email was sent", async () => {
    setEmailProviderForTests({
      name: "broken",
      send: async () => {
        throw new Error("provider down");
      },
    });
    const { verificationEmailSent } = await auth.register(registration());
    expect(verificationEmailSent).toBe(false);
    setEmailProviderForTests({ name: "capture", send: async (m) => void sent.push(m) });
  });
});

describe("login, lockout and sessions", () => {
  it("creates a valid session and rejects wrong passwords", async () => {
    const input = registration();
    await auth.register(input);
    const session = await auth.login({ email: input.email, password: input.password });
    expect((await validateSessionToken(session.token))?.user.email).toBe(input.email);
    expect(await validateSessionToken("forged-token")).toBeNull();
    await expect(auth.login({ email: input.email, password: "WrongPass123" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(auth.login({ email: "nobody@example.invalid", password: "x" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("locks the account after 5 failures", async () => {
    const input = registration();
    await auth.register(input);
    for (let i = 0; i < 5; i++)
      await auth.login({ email: input.email, password: "WrongPass123" }).catch(() => undefined);
    await expect(auth.login({ email: input.email, password: input.password })).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
    });
  });

  it("blocks suspended accounts and invalidates their sessions", async () => {
    const input = registration();
    const { user } = await auth.register(input);
    const session = await auth.login({ email: input.email, password: input.password });
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    expect(await validateSessionToken(session.token)).toBeNull();
    await expect(auth.login({ email: input.email, password: input.password })).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
    });
  });

  it("resets the password via a single-use link and revokes sessions", async () => {
    const input = registration();
    await auth.register(input);
    const session = await auth.login({ email: input.email, password: input.password });
    sent.splice(0);
    await auth.requestPasswordReset(input.email);
    await auth.requestPasswordReset("unknown@example.invalid"); // no error, no email: no enumeration
    expect(sent).toHaveLength(1);
    const token = new URL(/https?:\/\/\S+/.exec(sent[0].text)![0]).searchParams.get("token")!;
    await auth.resetPassword({ token, password: "NewPassword456" });
    expect(await validateSessionToken(session.token)).toBeNull();
    await expect(auth.resetPassword({ token, password: "Another789xx" })).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
    await expect(auth.login({ email: input.email, password: "NewPassword456" })).resolves.toBeTruthy();
  });
});
