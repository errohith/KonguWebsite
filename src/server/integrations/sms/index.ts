import "server-only";
import { getEnv } from "@/server/config/env";
import { AppError } from "@/server/lib/errors";

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<void>;
}

class DisabledSmsProvider implements SmsProvider {
  readonly name = "disabled";
  async send(): Promise<void> {
    throw new AppError("SERVICE_UNAVAILABLE", "SMS delivery is not configured");
  }
}

/** Development only. Add a real provider adapter here once one is chosen. */
class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(to: string, text: string): Promise<void> {
    console.info(`\n[sms:console] (NOT SENT — development provider) To: ${to}\n${text}\n`);
  }
}

let override: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (override) return override;
  return getEnv().SMS_PROVIDER === "console" ? new ConsoleSmsProvider() : new DisabledSmsProvider();
}

export function setSmsProviderForTests(provider: SmsProvider | undefined) {
  override = provider;
}
