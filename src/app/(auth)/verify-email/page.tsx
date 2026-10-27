import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { getT } from "@/i18n/server";
import { isAppError } from "@/server/lib/errors";
import { verifyEmail } from "@/server/modules/auth/service";

/**
 * Verification is a GET with a single-use token. Link-preview bots that
 * pre-fetch the URL would consume it, so the page asks for a click (POST
 * via the form) before verifying.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const [t, sp] = await Promise.all([getT(), searchParams]);
  const token = typeof sp.token === "string" ? sp.token : "";
  const confirmed = sp.confirm === "1";

  if (!token) return <Alert tone="error">{t("auth.verifyFailed")}</Alert>;

  if (!confirmed) {
    return (
      <>
        <h1 className="text-maroon-800 mb-6 text-2xl font-semibold">{t("auth.verifyTitle")}</h1>
        <form method="get">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="confirm" value="1" />
          <button className={buttonClass("primary")}>{t("common.confirm")}</button>
        </form>
      </>
    );
  }

  let ok = false;
  try {
    await verifyEmail(token);
    ok = true;
  } catch (err) {
    if (!isAppError(err)) throw err;
  }
  return (
    <>
      <h1 className="text-maroon-800 mb-6 text-2xl font-semibold">{t("auth.verifyTitle")}</h1>
      <Alert tone={ok ? "success" : "error"}>{ok ? t("auth.verified") : t("auth.verifyFailed")}</Alert>
      <Link href="/dashboard" className={buttonClass("primary", "md", "mt-6")}>
        {t("nav.dashboard")}
      </Link>
    </>
  );
}
