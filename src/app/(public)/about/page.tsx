import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getLocale, getT } from "@/i18n/server";
import { getContent } from "@/server/modules/content/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("about.title") };
}

export default async function AboutPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const story = await getContent("about.story", locale);
  return (
    <Container className="max-w-3xl py-12">
      <PageHeader title={t("about.title")} />
      <div className="space-y-4 text-lg leading-relaxed">
        <p>{t("about.body1")}</p>
        <p>{t("about.body2")}</p>
        {story?.body && <p className="whitespace-pre-line">{story.body}</p>}
      </div>
      <Card className="mt-10">
        <h2 className="text-maroon-800 text-xl font-semibold">{t("about.valuesTitle")}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>{t("about.value1")}</li>
          <li>{t("about.value2")}</li>
          <li>{t("about.value3")}</li>
        </ul>
      </Card>
    </Container>
  );
}
