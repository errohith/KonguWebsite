import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("safety.title") };
}

export default async function SafetyPage() {
  const t = await getT();
  return (
    <Container className="max-w-3xl py-12">
      <PageHeader title={t("safety.title")} subtitle={t("safety.intro")} />
      <Card>
        <ul className="space-y-3">
          {t.list("safety.tips").map((tip) => (
            <li key={tip} className="flex gap-3">
              <span className="bg-gold-500 mt-1.5 size-2 shrink-0 rounded-full" aria-hidden />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Container>
  );
}
