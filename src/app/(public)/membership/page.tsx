import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButton } from "@/components/membership/checkout-button";
import { buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card, Container, PageHeader } from "@/components/ui/card";
import { getLocale, getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import { getCurrentUser } from "@/server/modules/auth/current";
import { getEntitlements } from "@/server/modules/membership/entitlements";
import { listActivePlans } from "@/server/modules/membership/plans";
import { paymentsEnabled } from "@/server/modules/payments/service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("membership.title") };
}

function formatPrice(amount: string, currency: string, locale: string) {
  return new Intl.NumberFormat(locale === "ta" ? "ta-IN" : "en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default async function MembershipPage() {
  const [t, locale, user, plans] = await Promise.all([getT(), getLocale(), getCurrentUser(), listActivePlans()]);
  const ent = user ? await getEntitlements(user.id) : null;
  const canPay = paymentsEnabled();

  return (
    <Container className="py-12">
      <PageHeader
        title={t("membership.title")}
        subtitle={t("membership.subtitle")}
        actions={
          user ? (
            <Link href="/membership/history" className={buttonClass("secondary", "sm")}>
              {t("membership.history")}
            </Link>
          ) : undefined
        }
      />
      {ent?.isPremium && ent.endsAt && (
        <div className="mb-6">
          <Alert tone="success">
            {t("dashboard.plan", { plan: ent.planName })} ·{" "}
            {t("membership.validUntil", { date: ent.endsAt.toISOString().slice(0, 10) })}
          </Alert>
        </div>
      )}
      {!canPay && (
        <div className="mb-6">
          <Alert>{t("membership.paymentsDisabled")}</Alert>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const free = plan.price.lte(0);
          const name = locale === "ta" && plan.nameTa ? plan.nameTa : plan.name;
          const description = locale === "ta" && plan.descriptionTa ? plan.descriptionTa : plan.description;
          const benefits = locale === "ta" && plan.benefitsTa.length ? plan.benefitsTa : plan.benefits;
          const current = ent?.planCode === plan.code;
          return (
            <Card key={plan.id} className={plan.highlightProfile ? "border-gold-400 ring-gold-400/40 ring-2" : ""}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-maroon-800 text-xl font-semibold">{name}</h2>
                {current && <Badge tone="green">{t("membership.current")}</Badge>}
              </div>
              <p className="mt-3 text-3xl font-semibold">
                {free ? t("membership.free") : formatPrice(plan.price.toString(), plan.currency, locale)}
              </p>
              {!free && (
                <p className="text-muted text-sm">
                  {plan.durationDays} {t("membership.days")}
                </p>
              )}
              {description && <p className="text-muted mt-3 text-sm">{description}</p>}
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  ✓ {plan.interestsPerDay} {t("membership.perDay")}
                </li>
                {plan.canViewContacts && (
                  <li>
                    ✓ {plan.contactViewsIncluded} {t("membership.contacts")}
                  </li>
                )}
                {benefits.map((b) => (
                  <li key={b}>✓ {b}</li>
                ))}
              </ul>
              <div className="mt-6">
                {free ? null : !user ? (
                  <Link href="/login?next=/membership" className={buttonClass("secondary", "md", "w-full")}>
                    {t("membership.loginToBuy")}
                  </Link>
                ) : canPay ? (
                  <CheckoutButton planCode={plan.code} label={t("membership.choose")} appName={getEnv().APP_NAME} />
                ) : (
                  <Link href="/contact" className={buttonClass("secondary", "md", "w-full")}>
                    {t("nav.contact")}
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Container>
  );
}
