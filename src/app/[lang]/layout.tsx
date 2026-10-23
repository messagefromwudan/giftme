import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Caveat, League_Spartan, Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE } from "@/lib/catalog";
import { getDict, hasLocale, LOCALES } from "@/i18n";
import "../globals.css";

const leagueSpartan = League_Spartan({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "900"],
  variable: "--font-league-spartan",
});
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
});
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  variable: "--font-caveat",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return {
    metadataBase: new URL(SITE.url),
    title: { default: t.meta.title, template: `%s | GiftMe!` },
    description: t.meta.description,
    applicationName: SITE.name,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: lang === "ro" ? "ro_RO" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${leagueSpartan.variable} ${poppins.variable} ${caveat.variable} antialiased`}
    >
      <body className="min-h-dvh">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
