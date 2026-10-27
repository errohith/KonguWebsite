import "server-only";
import { getEnv } from "@/server/config/env";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { fetchWithTimeout, joinUrl } from "../http";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailProvider {
  readonly name: string;
  /** Resolves only when the provider accepted the message; throws otherwise. */
  send(message: EmailMessage): Promise<void>;
}

class DisabledEmailProvider implements EmailProvider {
  readonly name = "disabled";
  async send(): Promise<void> {
    throw new AppError("SERVICE_UNAVAILABLE", "Email delivery is not configured");
  }
}

/** Development only: prints the message to the server log instead of sending. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `\n[email:console] (NOT SENT — development provider)\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
    );
  }
}

/** Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly from: string,
  ) {}
  async send(message: EmailMessage): Promise<void> {
    const res = await fetchWithTimeout(joinUrl(this.apiUrl, "/emails"), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      logger.error("email.send_failed", { provider: this.name, status: res.status });
      throw new AppError("SERVICE_UNAVAILABLE", "Email provider rejected the message");
    }
  }
}

let override: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  const env = getEnv();
  switch (env.EMAIL_PROVIDER) {
    case "console":
      return new ConsoleEmailProvider();
    case "resend":
      return new ResendEmailProvider(env.EMAIL_API_URL!, env.EMAIL_API_KEY!, env.EMAIL_FROM_ADDRESS!);
    default:
      return new DisabledEmailProvider();
  }
}

export function isEmailConfigured(): boolean {
  return getEmailProvider().name !== "disabled";
}

/** Test seam: replace the provider (pass undefined to restore). */
export function setEmailProviderForTests(provider: EmailProvider | undefined) {
  override = provider;
}
