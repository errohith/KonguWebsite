import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("legal.privacyTitle") };
}

export default async function PrivacyPage() {
  const t = await getT();
  const { APP_NAME, SUPPORT_EMAIL, ACCOUNT_DELETION_GRACE_DAYS } = getEnv();
  const sections: LegalSection[] = [
    {
      heading: "1. Who we are",
      body: [
        `${APP_NAME} ("we", "us") operates a matrimony service for the Kongu community. This policy explains how we collect, use and protect personal data, including under India's Digital Personal Data Protection Act, 2023.`,
      ],
    },
    {
      heading: "2. Data we collect",
      body: [
        "Account data: email address, optional mobile number, password (stored only as a one-way hash), date of birth and gender (to confirm legal marriageable age).",
        "Profile data you choose to provide: name to display, education, occupation, income, location, family details, horoscope details, partner preferences and photographs.",
        "Verification documents you upload. These are visible only to our verification team and are never shown to other members.",
        "Usage data: interests sent and received, shortlists, blocks, reports, support requests, payments and notifications.",
      ],
    },
    {
      heading: "3. How we use your data",
      body: [
        "To operate your account, show your profile to eligible members according to your privacy settings, suggest matches, process payments, prevent fraud and abuse, and provide support.",
        "We do not sell personal data. We do not show your contact details to anyone unless you have accepted their interest and they hold a plan that includes contact access.",
      ],
    },
    {
      heading: "4. Your controls",
      body: [
        "You choose who can see your profile and photos. You can block or report any member, deactivate your account, download a copy of your data, and request deletion from Settings.",
        `When you request deletion, your profile is hidden immediately and personal data is erased after ${ACCOUNT_DELETION_GRACE_DAYS} days. Payment and tax records are retained for the period required by law, linked only to an anonymised account.`,
      ],
    },
    {
      heading: "5. Service providers",
      body: [
        "We use carefully selected providers for hosting, email, SMS, payments and file storage. They process data only on our instructions. Card and bank details are handled by the payment provider and never stored by us.",
      ],
    },
    {
      heading: "6. Security",
      body: [
        "Data is encrypted in transit. Passwords are hashed with Argon2id. Access to member data by our staff is limited by role and recorded in audit logs.",
      ],
    },
    {
      heading: "7. Contact",
      body: [`For privacy questions or to exercise your rights, contact ${SUPPORT_EMAIL}.`],
    },
  ];
  return (
    <LegalPage
      title={t("legal.privacyTitle")}
      notice={t("legal.reviewNotice")}
      updated="2026-10-27"
      sections={sections}
    />
  );
}
