"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/catalog";
import { getDict, href } from "@/i18n";

export function PassItOn({
  lang,
  messageId,
  initial,
}: {
  lang: Locale;
  messageId: string;
  initial: { code: string; expiresAt?: string } | null;
}) {
  const t = getDict(lang).msg;
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/messages/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: messageId }),
      });
      if (!res.ok) throw new Error();
      setCode(await res.json());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const date = (iso?: string) =>
    iso
      ? new Intl.DateTimeFormat(lang === "ro" ? "ro-MD" : "en-GB", { dateStyle: "long", timeZone: "Europe/Chisinau" }).format(new Date(iso))
      : "";

  return (
    <section aria-labelledby="pass-title" className="rounded-3xl bg-red p-6 text-white sm:p-8">
      <h2 id="pass-title" className="text-3xl sm:text-4xl">
        {t.passTitle}
      </h2>
      <p className="mt-3 text-lg">{t.passText}</p>
      {code ? (
        <div className="mt-6 rounded-2xl bg-white p-5 text-ink" role="status">
          <p className="text-sm text-muted">{t.passCode}</p>
          <p className="font-display text-4xl font-black tracking-wider">{code.code}</p>
          <p className="mt-2 text-sm">{t.passValid(date(code.expiresAt))}</p>
          <Link href={`${href(lang)}#cutii`} className="btn btn-primary mt-4">
            {t.passShop} →
          </Link>
        </div>
      ) : (
        <button type="button" onClick={reveal} disabled={busy} className="btn mt-6 bg-white text-ink hover:bg-blush">
          {busy ? "…" : t.passButton}
        </button>
      )}
      {error && <p className="mt-3 font-medium">{getDict(lang).msg.errors.generic}</p>}
    </section>
  );
}
