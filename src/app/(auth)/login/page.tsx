import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/modules/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.loginTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [t, user, sp] = await Promise.all([getT(), getCurrentUser(), searchParams]);
  if (user) redirect("/dashboard");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <h1 className="text-maroon-800 mb-6 text-2xl font-semibold">{t("auth.loginTitle")}</h1>
      {sp.reset && (
        <div className="mb-4">
          <Alert tone="success">{t("auth.resetDone")}</Alert>
        </div>
      )}
      <LoginForm next={next} />
      <p className="text-muted mt-6 text-sm">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="text-maroon-700 font-medium underline">
          {t("nav.register")}
        </Link>
      </p>
    </>
  );
}
