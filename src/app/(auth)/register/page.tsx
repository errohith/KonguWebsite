import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/forms";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/modules/auth/current";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.registerTitle") };
}

export default async function RegisterPage() {
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  if (user) redirect("/dashboard");
  return (
    <>
      <h1 className="text-maroon-800 mb-6 text-2xl font-semibold">{t("auth.registerTitle")}</h1>
      <RegisterForm />
      <p className="text-muted mt-6 text-sm">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-maroon-700 font-medium underline">
          {t("nav.login")}
        </Link>
      </p>
    </>
  );
}
