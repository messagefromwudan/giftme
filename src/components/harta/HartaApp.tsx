"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getBox, type Locale } from "@/lib/catalog";
import type { Answers, Proposal } from "@/lib/harta";
import { useCart } from "@/lib/cart";
import { getDict, href } from "@/i18n";
import { BoxImage } from "../BoxImage";

type Msg = { role: "user" | "assistant"; content: string };
type Shown = Msg & { proposal?: Proposal | null };

const MAX_USER_MESSAGES = 12;
const CHECKOUT_DRAFT = "giftme-checkout-draft-v1";

/** compact: inside the chat widget panel (narrow, always one column). */
export function HartaApp({ lang, compact = false }: { lang: Locale; compact?: boolean }) {
  const t = getDict(lang).harta;
  const inputId = useId();
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [started, setStarted] = useState(false);
  const [shown, setShown] = useState<Shown[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shown.length, busy]);

  const complete = answers.who && answers.occasion && answers.personality && answers.budget;
  const userTurns = shown.filter((m) => m.role === "user").length;

  async function ask(history: Msg[]) {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/harta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, answers, messages: history }),
      });
      const j = await res.json();
      if (!res.ok) {
        setNotice(j.error === "SESSION_LIMIT" ? t.limit : j.error === "RATE_LIMITED" ? t.rate : t.error);
        return;
      }
      setShown((prev) => [
        ...prev,
        { role: "assistant", content: j.text, proposal: j.proposal },
      ]);
    } catch {
      setNotice(t.error);
    } finally {
      setBusy(false);
    }
  }

  // The model sees text only; proposals are shown to the customer as cards.
  const history = (list: Shown[]): Msg[] => list.map(({ role, content }) => ({ role, content }));

  function start() {
    setStarted(true);
    setShown([]);
    void ask([]);
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    if (userTurns >= MAX_USER_MESSAGES) return setNotice(t.limit);
    const next: Shown[] = [...shown, { role: "user", content: text.slice(0, 500) }];
    setShown(next);
    setInput("");
    void ask(history(next));
  }

  if (!started) {
    return (
      <div className={compact ? "space-y-6" : "space-y-8"}>
        {(["who", "occasion", "personality"] as const).map((k) => (
          <fieldset key={k}>
            <legend className={`mb-3 font-display font-black ${compact ? "text-lg" : "text-xl"}`}>{t.q[k]}</legend>
            <div className="flex flex-wrap gap-2">
              {t[k].map((opt) => (
                <Chip key={opt} on={answers[k] === opt} onClick={() => setAnswers((a) => ({ ...a, [k]: opt }))}>
                  {opt}
                </Chip>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className={`mb-3 font-display font-black ${compact ? "text-lg" : "text-xl"}`}>{t.q.budget}</legend>
          <div className="flex flex-wrap gap-2">
            {t.budget.map(([v, label]) => (
              <Chip key={v} on={answers.budget === v} onClick={() => setAnswers((a) => ({ ...a, budget: v as Answers["budget"] }))}>
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <button type="button" className="btn btn-primary" disabled={!complete} onClick={start}>
          {t.start} →
        </button>
        <p className="text-sm text-muted-dark">{t.disclaimer}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4" aria-live="polite">
        {shown.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-red px-4 py-2.5 text-white">
              {m.content}
            </p>
          ) : (
            <div key={i} className="space-y-3">
              <p className="w-fit max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-ink">{m.content}</p>
              {m.proposal && <ProposalCard p={m.proposal} lang={lang} compact={compact} />}
            </div>
          ),
        )}
        {busy && <p className="animate-pulse text-muted-dark">{t.thinking}</p>}
        <div ref={end} />
      </div>
      {notice && (
        <p role="alert" className="font-medium text-[#ff8a92]">
          {notice}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t.placeholder}
        </label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder={t.placeholder}
          disabled={busy || userTurns >= MAX_USER_MESSAGES}
          className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-ink placeholder:text-muted"
        />
        <button className="btn btn-primary shrink-0" disabled={busy || !input.trim()}>
          {t.send}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-dark">
        <span>{t.disclaimer}</span>
        <button type="button" className="underline" onClick={() => setStarted(false)}>
          {t.restart}
        </button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-4 py-2 font-medium transition ${on ? "bg-white text-ink" : "ring-1 ring-white/30 hover:ring-white"}`}
    >
      {children}
    </button>
  );
}

function ProposalCard({ p, lang, compact }: { p: Proposal; lang: Locale; compact: boolean }) {
  const t = getDict(lang).harta;
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const first = getBox(p.items[0]?.boxId ?? "");

  function addAll() {
    for (const i of p.items) cart.add(i.boxId, i.quantity);
    if (p.customGift) {
      // Pre-fill the GM-09 gift idea at checkout.
      try {
        const draft = JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT) ?? "{}");
        sessionStorage.setItem(CHECKOUT_DRAFT, JSON.stringify({ ...draft, giftIdea: p.customGift }));
      } catch {}
    }
    setAdded(true);
  }

  return (
    <div className={`overflow-hidden rounded-3xl bg-white text-ink ${compact ? "" : "sm:flex"}`}>
      {first && (
        <BoxImage
          box={first}
          lang={lang}
          decorative
          sizes={compact ? "400px" : "(min-width: 640px) 224px, 92vw"}
          className={`w-full ${compact ? "aspect-[2/1]" : "aspect-[4/3] sm:w-56 sm:shrink-0"}`}
        />
      )}
      <div className="flex-1 space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{t.proposalTitle}</p>
        {p.items.map((i) => (
          <p key={i.boxId} className="font-display text-2xl font-black">
            {i.quantity > 1 ? `${i.quantity} × ` : ""}
            <Link href={i.url.replace(/^https:\/\/www\.giftme\.site/, "")} className="hover:text-red" target="_blank">
              {i.name}
            </Link>
          </p>
        ))}
        {p.summary && <p className="text-muted">{p.summary}</p>}
        {p.reasons.length === 0 && first && (
          <ul className="space-y-1 text-sm">
            {first.contents.map((c) => (
              <li key={c.ro}>
                <span className="text-red">✓</span> {c[lang]}
              </li>
            ))}
          </ul>
        )}
        {p.reasons.length > 0 && (
          <div>
            <p className="text-sm font-semibold">{t.why}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {p.reasons.map((r) => (
                <li key={r.product}>
                  <span className="hand text-lg text-red">♥</span> <strong>{r.product}</strong>: {r.why}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.customGift && <p className="rounded-xl bg-blush p-2 text-sm">{t.giftNote(p.customGift)}</p>}
        <p>
          <span className="font-display text-xl font-black">
            {p.total} MDL{p.customGiftPending ? ` + ${lang === "ro" ? "cadoul" : "the gift"}` : ""}
          </span>
          {p.offer && <span className="ml-2 text-sm text-red-dark">{p.offer}</span>}
          <span className="block text-xs text-muted">{t.deliveryNote}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={addAll} disabled={added}>
            {added ? t.added : t.add}
          </button>
          {added && (
            <Link href={href(lang, "/cos/")} className="btn btn-ghost">
              {t.goCart} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
