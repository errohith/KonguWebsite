import { ContentForm, FaqForm } from "@/components/admin/forms";
import { Card, PageHeader } from "@/components/ui/card";
import { saveContentAction, saveFaqAction } from "@/server/actions/admin";
import { requirePermission } from "@/server/modules/auth/current";
import { CONTENT_KEYS, listContent, listFaqs } from "@/server/modules/content/service";
import { DeleteFaqButton } from "@/components/admin/delete-faq";

export default async function ContentPage() {
  await requirePermission("content.manage");
  const [blocks, faqsEn, faqsTa] = await Promise.all([listContent(), listFaqs("en", true), listFaqs("ta", true)]);
  return (
    <>
      <PageHeader
        title="Website content"
        subtitle="Editable blocks shown on public pages, per language. Tamil falls back to English when empty."
      />
      {blocks.map((b) => (
        <Card key={b.id}>
          <p className="mb-2 text-sm font-semibold">
            {b.key} · {b.locale}
          </p>
          <ContentForm action={saveContentAction} keys={CONTENT_KEYS} d={b} />
        </Card>
      ))}
      <Card>
        <h2 className="mb-3 font-semibold">Add / replace block</h2>
        <ContentForm action={saveContentAction} keys={CONTENT_KEYS} />
      </Card>
      <h2 className="text-maroon-800 text-lg font-semibold">FAQs</h2>
      {[...faqsEn, ...faqsTa].map((f) => (
        <Card key={f.id}>
          <FaqForm action={saveFaqAction.bind(null, f.id)} d={f} />
          <div className="mt-2">
            <DeleteFaqButton id={f.id} />
          </div>
        </Card>
      ))}
      <Card>
        <h2 className="mb-3 font-semibold">New FAQ</h2>
        <FaqForm action={saveFaqAction.bind(null, null)} />
      </Card>
    </>
  );
}
