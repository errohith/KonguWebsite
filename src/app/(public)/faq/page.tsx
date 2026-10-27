import type { Metadata } from "next";
import { Container, EmptyState, PageHeader } from "@/components/ui/card";
import { getLocale, getT } from "@/i18n/server";
import { listFaqs } from "@/server/modules/content/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("faq.title") };
}

export default async function FaqPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const faqs = await listFaqs(locale);
  return (
    <Container className="max-w-3xl py-12">
      <PageHeader title={t("faq.title")} />
      {faqs.length === 0 ? (
        <EmptyState>{t("faq.empty")}</EmptyState>
      ) : (
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.id} className="group border-line rounded-2xl border bg-white p-5">
              <summary className="text-maroon-800 cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                {f.question}
              </summary>
              <p className="text-muted mt-3 whitespace-pre-line">{f.answer}</p>
            </details>
          ))}
        </div>
      )}
    </Container>
  );
}
