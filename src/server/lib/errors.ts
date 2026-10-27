/**
 * Domain errors thrown by services. API handlers and server actions map
 * these to HTTP status codes / form messages; anything else is a 500.
 * `code` doubles as the i18n key suffix (errors.<code>).
 */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "FEATURE_DISABLED"
  | "SERVICE_UNAVAILABLE"
  | "ENTITLEMENT_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_INACTIVE"
  | "EMAIL_NOT_VERIFIED"
  | "UNDERAGE"
  | "INVALID_TOKEN"
  | "PAYMENT_VERIFICATION_FAILED";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  FEATURE_DISABLED: 403,
  SERVICE_UNAVAILABLE: 503,
  ENTITLEMENT_REQUIRED: 402,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  ACCOUNT_INACTIVE: 403,
  EMAIL_NOT_VERIFIED: 403,
  UNDERAGE: 400,
  INVALID_TOKEN: 400,
  PAYMENT_VERIFICATION_FAILED: 400,
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
  get status() {
    return STATUS[this.code];
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
