import { ResetPasswordForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/card";
import { getT } from "@/i18n/server";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <>
      <h1 className="text-maroon-800 mb-6 text-2xl font-semibold">{t("auth.resetTitle")}</h1>
      {token ? <ResetPasswordForm token={token} /> : <Alert tone="error">{t("errors.INVALID_TOKEN")}</Alert>}
    </>
  );
}
