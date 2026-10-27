import type { UserRole } from "@/generated/prisma/enums";

const STAFF: UserRole[] = ["SUPPORT", "MODERATOR", "ADMIN", "SUPER_ADMIN"];
const ADMINS: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

/** Role-based permissions for the administration area. */
export const PERMISSIONS = {
  "admin.access": STAFF,
  "moderation.manage": ["MODERATOR", "ADMIN", "SUPER_ADMIN"],
  "support.manage": ["SUPPORT", "ADMIN", "SUPER_ADMIN"],
  "members.view": STAFF,
  "members.manage": ADMINS,
  "plans.manage": ADMINS,
  "payments.manage": ADMINS,
  "content.manage": ADMINS,
  "audit.view": ADMINS,
  "roles.manage": ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}
