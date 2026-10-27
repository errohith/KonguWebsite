"use client";

import { Container } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <Container className="py-24 text-center">
      <h1 className="text-maroon-800 text-2xl font-semibold">{t("common.error")}</h1>
      {error.digest && <p className="text-muted mt-2 font-mono text-xs">ref: {error.digest}</p>}
      <button onClick={reset} className={buttonClass("primary", "md", "mt-8")}>
        {t("common.back")}
      </button>
    </Container>
  );
}
