import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { SCENARIOS } from "@/lib/agent-demo";
import { PageShell } from "@/components/PageShell";
import { DemoConsole } from "@/components/demo/DemoConsole";
import { PracticeNotice } from "@/components/shop/PracticeNotice";

export async function generateMetadata({ params }: PageProps<"/[lang]/agent-demo">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(hasLocale(lang) ? lang : "ro").demo;
  return { title: t.title, description: t.copy, alternates: { canonical: lang === "en" ? "/en/agent-demo/" : "/agent-demo/" } };
}

export default async function AgentDemoPage({ params }: PageProps<"/[lang]/agent-demo">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang).demo;
  const docs = [
    ["/llms.txt", "llms.txt"],
    ["/catalog.json", "catalog.json"],
    ["/openapi.json", "OpenAPI 3.1"],
    ["/.well-known/mcp.json", "MCP /mcp"],
  ];
  return (
    <PageShell lang={lang} altHref={lang === "ro" ? "/en/agent-demo/" : "/agent-demo/"}>
      <div className="bg-ink text-white">
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 md:py-16">
          <div className="max-w-3xl">
            <p className="eyebrow !text-[#ff8a92]">{t.eyebrow}</p>
            <h1 className="mt-3 text-4xl sm:text-6xl">{t.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-dark">{t.copy}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-dark">{t.docs}:</span>
              {docs.map(([href, label]) => (
                <a key={href} href={href} target="_blank" className="rounded-full px-3 py-1 font-mono ring-1 ring-white/25 hover:ring-white">
                  {label}
                </a>
              ))}
            </div>
          </div>
          <DemoConsole lang={lang} scenarios={SCENARIOS.map((s) => ({ id: s.id, title: s.title[lang] }))} />
          <div className="max-w-xl text-ink">
            <PracticeNotice lang={lang} compact />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
