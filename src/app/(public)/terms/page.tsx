import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("legal.termsTitle") };
}

export default async function TermsPage() {
  const t = await getT();
  const { APP_NAME, SUPPORT_EMAIL, MIN_AGE_MALE, MIN_AGE_FEMALE } = getEnv();
  const sections: LegalSection[] = [
    {
      heading: "1. Eligibility",
      body: [
        `${APP_NAME} is for people seeking marriage. Members must be at least ${MIN_AGE_MALE} (men) or ${MIN_AGE_FEMALE} (women) years old, legally able to marry, and not currently married (except where awaiting divorce is declared).`,
        "Profiles created by parents, siblings or relatives must be created with the knowledge and consent of the person concerned.",
      ],
    },
    {
      heading: "2. Your responsibilities",
      body: [
        "Provide accurate information and keep it up to date. Do not impersonate anyone, upload photographs you do not have rights to, or use the service for commercial purposes.",
        "Treat other members with respect. Harassment, threats, requests for money and sharing other members' details are prohibited.",
      ],
    },
    {
      heading: "3. Profile review and verification",
      body: [
        "We review profiles and photographs before publishing and may reject, suspend or remove content that breaches these terms. A verified badge means we checked an identity document; it is not a guarantee of any other information.",
      ],
    },
    {
      heading: "4. Membership and payments",
      body: [
        "Paid plans provide the benefits shown at the time of purchase for the stated duration. Plans are not automatically renewed.",
        "Refunds are considered case by case in line with applicable consumer law. Contact support for any payment issue.",
      ],
    },
    {
      heading: "5. Limitation of liability",
      body: [
        "We provide an introduction platform and do not verify every statement made by members. Please follow our Safety guidelines and make your own enquiries before any commitment.",
      ],
    },
    {
      heading: "6. Contact",
      body: [`Questions about these terms: ${SUPPORT_EMAIL}.`],
    },
  ];
  return (
    <LegalPage
      title={t("legal.termsTitle")}
      notice={t("legal.reviewNotice")}
      updated="2026-10-27"
      sections={sections}
    />
  );
}
