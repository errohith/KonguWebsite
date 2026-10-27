import { ForgotPasswordForm } from "@/components/auth/forms";
import { getT } from "@/i18n/server";

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <>
      <h1 className="text-maroon-800 text-2xl font-semibold">{t("auth.forgotTitle")}</h1>
      <p className="text-muted mt-2 mb-6 text-sm">{t("auth.forgotIntro")}</p>
      <ForgotPasswordForm />
    </>
  );
}
