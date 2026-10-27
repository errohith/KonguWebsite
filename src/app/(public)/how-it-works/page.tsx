import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("how.title") };
}

export default async function HowItWorksPage() {
  const t = await getT();
  return (
    <Container className="max-w-3xl py-12">
      <PageHeader title={t("how.title")} />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <h2 className="text-maroon-800 text-lg font-semibold">{t(`how.s${i}Title`)}</h2>
            <p className="text-muted mt-1">{t(`how.s${i}Body`)}</p>
          </Card>
        ))}
      </div>
    </Container>
  );
}
