import type { Metadata } from "next";
import { TicketForm } from "@/components/support/ticket-form";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getLocale, getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { getCurrentUser } from "@/server/modules/auth/current";
import { getContent } from "@/server/modules/content/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("contact.title") };
}

export default async function ContactPage() {
  const [t, locale, user] = await Promise.all([getT(), getLocale(), getCurrentUser()]);
  const office = await getContent("contact.office", locale);
  const email = getEnv().SUPPORT_EMAIL;
  return (
    <Container className="grid gap-8 py-12 lg:grid-cols-[2fr_1fr]">
      <div>
        <PageHeader title={t("contact.title")} subtitle={t("contact.intro")} />
        <Card>
          <TicketForm defaultEmail={user?.email} />
        </Card>
      </div>
      <aside className="space-y-4 lg:pt-20">
        <Card>
          <p className="text-muted text-sm">{t("contact.emailUs")}</p>
          <a href={`mailto:${email}`} className="text-maroon-700 font-medium underline">
            {email}
          </a>
        </Card>
        {office?.body && (
          <Card>
            {office.title && <p className="font-medium">{office.title}</p>}
            <p className="text-muted mt-1 text-sm whitespace-pre-line">{office.body}</p>
          </Card>
        )}
      </aside>
    </Container>
  );
}
