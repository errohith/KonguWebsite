import "server-only";
import { z } from "zod";
import { db } from "@/server/db/client";
import { audit } from "@/server/lib/audit";
import { checkbox } from "@/server/lib/validation";

export async function listActivePlans() {
  return db.membershipPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

export async function listAllPlans() {
  return db.membershipPlan.findMany({ orderBy: { sortOrder: "asc" } });
}

const lines = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const planInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,32}$/, "errors.invalidPlanCode"),
  name: z.string().trim().min(1).max(60),
  nameTa: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
  descriptionTa: z.string().trim().max(500).optional(),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "errors.invalidAmount"),
  currency: z.string().trim().toUpperCase().length(3).default("INR"),
  durationDays: z.coerce.number().int().min(1).max(3650),
  interestsPerDay: z.coerce.number().int().min(0).max(1000),
  contactViewsIncluded: z.coerce.number().int().min(0).max(100000),
  canViewContacts: checkbox,
  canViewPremiumOnly: checkbox,
  highlightProfile: checkbox,
  benefits: lines,
  benefitsTa: lines,
  isActive: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function upsertPlan(actorUserId: string, raw: unknown, id?: string) {
  const input = planInputSchema.parse(raw);
  const plan = await db.$transaction(async (tx) => {
    const saved = id
      ? await tx.membershipPlan.update({ where: { id }, data: input })
      : await tx.membershipPlan.create({ data: input });
    await audit(
      {
        actorUserId,
        action: id ? "plan.update" : "plan.create",
        entityType: "MembershipPlan",
        entityId: saved.id,
        metadata: { code: saved.code, price: saved.price.toString(), isActive: saved.isActive },
      },
      tx,
    );
    return saved;
  });
  return plan;
}
