import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getDict, hasLocale } from "@/i18n";
import type { Locale } from "@/lib/catalog";
import { messageForRecipient } from "@/lib/messages";
import { PassItOn } from "@/components/messages/PassItOn";
import { ChatWidget } from "@/components/assistant/ChatWidget";

export const metadata: Metadata = {
  title: "Un mesaj pentru tine",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// What the recipient sees after scanning the QR code on the box. Private: reachable only with
// the long id; media comes as a short-lived signed URL created on each visit.
export default function MessagePage({ params }: PageProps<"/[lang]/mesaj/[id]">) {
  return (
    <main className="min-h-dvh bg-ink px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-block">
          <Image src="/logo-original.png" alt="GiftMe!" width={1671} height={941} className="h-12 w-auto" priority sizes="100px" />
        </Link>
        <Suspense fallback={<p className="mt-16 text-center text-muted-dark">…</p>}>
          <Message params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Message({ params }: { params: PageProps<"/[lang]/mesaj/[id]">["params"] }) {
  const { lang: routeLang, id } = await params;
  const m = await messageForRecipient(id);
  // Speak the language the buyer ordered in (the QR link has no language prefix).
  const lang: Locale = m?.lang ?? (hasLocale(routeLang) ? routeLang : "ro");
  const t = getDict(lang).msg;

  if (!m) {
    return (
      <div className="mt-16 text-center">
        <p className="hand text-5xl text-red">GiftMe!</p>
        <p className="mt-4 text-lg">{t.missing}</p>
        <ChatWidget lang={lang} />
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      <div>
        <p className="hand text-4xl text-[#ff8a92]">{t.someone}</p>
        <h1 className="mt-2 text-5xl sm:text-6xl">{t.forYou(m.recipient)}</h1>
        {m.occasion && <p className="mt-2 text-lg text-muted-dark">{m.occasion}</p>}
      </div>

      <div className="rounded-3xl bg-white p-6 text-ink sm:p-8">
        {m.kind === "text" && <p className="hand whitespace-pre-line text-3xl leading-snug">{m.text}</p>}
        {m.kind === "audio" && m.mediaUrl && <audio src={m.mediaUrl} controls className="w-full" preload="metadata" />}
        {m.kind === "video" && m.mediaUrl && (
          <video src={m.mediaUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-ink" />
        )}
      </div>

      <PassItOn lang={lang} messageId={m.id} initial={m.passCode ? { code: m.passCode.code, expiresAt: m.passCode.expiresAt } : null} />
      <ChatWidget lang={lang} />
    </div>
  );
}
