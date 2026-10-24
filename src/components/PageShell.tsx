import type { ReactNode } from "react";
import type { Locale } from "@/lib/catalog";
import { AnnounceBar, SiteFooter, SiteHeader, SkipLink } from "./SiteChrome";
import { ChatWidget } from "./assistant/ChatWidget";

export function PageShell({
  lang,
  altHref,
  children,
}: {
  lang: Locale;
  altHref: string;
  children: ReactNode;
}) {
  return (
    <>
      <div id="top" />
      <SkipLink lang={lang} />
      <AnnounceBar lang={lang} />
      <SiteHeader lang={lang} altHref={altHref} />
      <main id="continut">{children}</main>
      <SiteFooter lang={lang} />
      <ChatWidget lang={lang} />
    </>
  );
}
