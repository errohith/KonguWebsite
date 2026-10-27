import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Tamil, Playfair_Display } from "next/font/google";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { getEnv } from "@/server/config/env";
import "./globals.css";

const body = Noto_Sans({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const heading = Playfair_Display({ variable: "--font-heading", subsets: ["latin"], display: "swap" });
const tamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  const t = await getT();
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: env.APP_NAME, template: `%s · ${env.APP_NAME}` },
    description: t("meta.tagline"),
    robots: env.APP_ENV === "production" ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: "#7a1f2b", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${body.variable} ${heading.variable} ${tamil.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
