import "server-only";
import { z } from "zod";
import { db } from "@/server/db/client";
import { audit } from "@/server/lib/audit";
import { checkbox } from "@/server/lib/validation";

type Locale = "en" | "ta";

/** Administrator-editable content keys rendered on public pages. */
export const CONTENT_KEYS = ["home.announcement", "about.story", "contact.office"] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

/** Content for a locale, falling back to English, then null. */
export async function getContent(key: ContentKey, locale: Locale) {
  const rows = await db.siteContent.findMany({ where: { key, locale: { in: [locale, "en"] } } });
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en") ?? null;
}

export async function listContent() {
  return db.siteContent.findMany({ orderBy: [{ key: "asc" }, { locale: "asc" }] });
}

const contentSchema = z.object({
  key: z.enum(CONTENT_KEYS),
  locale: z.enum(["en", "ta"]),
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  body: z.string().trim().max(10_000),
});

export async function upsertContent(actorUserId: string, raw: unknown) {
  const input = contentSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const row = await tx.siteContent.upsert({
      where: { key_locale: { key: input.key, locale: input.locale } },
      create: { ...input, updatedById: actorUserId },
      update: { title: input.title, body: input.body, updatedById: actorUserId },
    });
    await audit(
      {
        actorUserId,
        action: "content.update",
        entityType: "SiteContent",
        entityId: row.id,
        metadata: { key: input.key, locale: input.locale },
      },
      tx,
    );
  });
}

export async function listFaqs(locale: Locale, includeUnpublished = false) {
  const rows = await db.faq.findMany({
    where: { locale, ...(includeUnpublished ? {} : { isPublished: true }) },
    orderBy: { sortOrder: "asc" },
  });
  if (rows.length || locale === "en" || includeUnpublished) return rows;
  return db.faq.findMany({ where: { locale: "en", isPublished: true }, orderBy: { sortOrder: "asc" } });
}

const faqSchema = z.object({
  locale: z.enum(["en", "ta"]),
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(3).max(5000),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isPublished: checkbox,
});

export async function upsertFaq(actorUserId: string, raw: unknown, id?: string) {
  const input = faqSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const faq = id ? await tx.faq.update({ where: { id }, data: input }) : await tx.faq.create({ data: input });
    await audit({ actorUserId, action: id ? "faq.update" : "faq.create", entityType: "Faq", entityId: faq.id }, tx);
  });
}

export async function deleteFaq(actorUserId: string, id: string) {
  await db.$transaction(async (tx) => {
    await tx.faq.delete({ where: { id } });
    await audit({ actorUserId, action: "faq.delete", entityType: "Faq", entityId: id }, tx);
  });
}
