import { Alert, Container, PageHeader } from "@/components/ui/card";

export type LegalSection = { heading: string; body: string[] };

export function LegalPage({
  title,
  notice,
  updated,
  sections,
}: {
  title: string;
  notice: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <Container className="max-w-3xl py-12">
      <PageHeader title={title} subtitle={`Last updated: ${updated}`} />
      <Alert>{notice}</Alert>
      <article className="mt-8 space-y-8" lang="en">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-maroon-800 text-xl font-semibold">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p.slice(0, 40)} className="text-ink/90 mt-3 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </Container>
  );
}
