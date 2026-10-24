"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Locale } from "@/lib/catalog";
import { getDict } from "@/i18n";
import { CONTACT, staticQuestions } from "@/lib/site-faq";
import { HartaApp } from "../harta/HartaApp";

// Site-wide chat: a floating button (bottom right; the cart lives in the sticky header, top right)
// that opens a panel with two starting points: Harta emoției and free questions about GiftMe.
// The conversation lives only in this component's state: nothing is stored.

type View = "home" | "harta" | "ask";
type Msg = { role: "user" | "assistant"; content: string };

const MAX_ASK_MESSAGES = 10;

export function ChatWidget({ lang }: { lang: Locale }) {
  const t = getDict(lang).chat;
  const [open, setOpen] = useState(false);
  // The panel mounts on first open and then stays mounted, so closing keeps the conversation.
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("home");
  const panelId = useId();
  const titleId = useId();
  const launcher = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open, view]);

  // Back to the button after closing; on phones it is hidden while the panel is open, so this
  // runs after the render that shows it again.
  useEffect(() => {
    if (!open && wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function show() {
    setMounted(true);
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }

  // Escape closes; Tab stays inside the open panel.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      hide();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex='0']")].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => (open ? hide() : show())}
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        aria-label={open ? t.close : t.open}
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 grid size-14 place-items-center rounded-full bg-red text-white shadow-lg shadow-black/25 transition hover:bg-red-dark ${open ? "max-sm:hidden" : ""}`}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {mounted && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          hidden={!open}
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex flex-col bg-ink text-white sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[min(680px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-3xl sm:shadow-2xl sm:shadow-black/40"
        >
          <div className="flex items-center gap-3 border-b border-white/15 px-4 py-3">
            {view !== "home" && (
              <button type="button" onClick={() => setView("home")} className="rounded-full px-2 py-1 text-sm ring-1 ring-white/30 hover:ring-white">
                ← {t.back}
              </button>
            )}
            <h2 ref={heading} id={titleId} tabIndex={-1} className="min-w-0 flex-1 truncate font-display text-lg font-black outline-none">
              {view === "harta" ? t.hartaTitle : view === "ask" ? t.askTitle : t.title}
            </h2>
            <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">{t.aiBadge}</span>
            <button type="button" onClick={hide} aria-label={t.close} className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-white/30 hover:ring-white">
              <CloseIcon />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div hidden={view !== "home"} className="space-y-4">
              <p className="leading-relaxed">{t.intro}</p>
              <StartButton title={t.hartaTitle} desc={t.hartaDesc} onClick={() => setView("harta")} />
              <StartButton title={t.askTitle} desc={t.askDesc} onClick={() => setView("ask")} />
            </div>
            {/* Both conversations stay mounted, so switching views keeps them. */}
            <div hidden={view !== "harta"}>
              <HartaApp lang={lang} compact />
            </div>
            <div hidden={view !== "ask"}>
              <AskChat lang={lang} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StartButton({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/20 transition hover:bg-white/15 hover:ring-white">
      <span className="block font-display text-xl font-black">{title} →</span>
      <span className="mt-1 block text-sm text-muted-dark">{desc}</span>
    </button>
  );
}

function AskChat({ lang }: { lang: Locale }) {
  const t = getDict(lang).chat;
  const faq = staticQuestions(lang);
  const inputId = useId();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  /** The AI is unavailable: show the fixed answers instead. */
  const [fallback, setFallback] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  const userTurns = msgs.filter((m) => m.role === "user").length;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length, busy, fallback]);

  async function ask(text: string) {
    const q = text.trim().slice(0, 500);
    if (!q || busy || fallback) return;
    if (userTurns >= MAX_ASK_MESSAGES) return setNotice(t.limit);
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, messages: next }),
      });
      const j = await res.json();
      if (!res.ok) {
        setNotice(j.error === "SESSION_LIMIT" ? t.limit : j.error === "RATE_LIMITED" ? t.rate : t.error);
        if (j.error !== "SESSION_LIMIT") setFallback(true);
        return;
      }
      setMsgs((prev) => [...prev, { role: "assistant", content: j.text }]);
      if (j.fallback && j.fallback !== "refusal") setFallback(true);
    } catch {
      setNotice(t.error);
      setFallback(true);
    } finally {
      setBusy(false);
    }
  }

  function send(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="space-y-4">
      <p role="note" className="rounded-2xl bg-white/10 p-3 text-sm leading-relaxed">
        {t.askNotice}
      </p>

      <div role="log" aria-live="polite" className="space-y-3">
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-red px-4 py-2.5 text-white">
              <span className="sr-only">{t.you}: </span>
              {m.content}
            </p>
          ) : (
            <p key={i} className="w-fit max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-ink">
              <span className="sr-only">{t.bot}: </span>
              <Linkified text={m.content} />
            </p>
          ),
        )}
        {busy && <p className="animate-pulse text-muted-dark">{t.thinking}</p>}
      </div>

      {notice && (
        <p role="alert" className="font-medium text-[#ff8a92]">
          {notice}
        </p>
      )}

      {fallback ? (
        <section aria-labelledby={`${inputId}-faq`} className="space-y-2">
          <h3 id={`${inputId}-faq`} className="font-display text-lg font-black">
            {t.fallbackTitle}
          </h3>
          {faq.map((f) => (
            <details key={f.q} className="rounded-2xl bg-white/10 px-4 py-3">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-dark">{f.a}</p>
            </details>
          ))}
        </section>
      ) : (
        <>
          {msgs.length === 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">{t.suggestions}</p>
              <div className="flex flex-wrap gap-2">
                {faq.slice(0, 4).map((f) => (
                  <button key={f.q} type="button" onClick={() => void ask(f.q)} className="rounded-full px-3 py-1.5 text-left text-sm ring-1 ring-white/30 hover:ring-white">
                    {f.q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={send} className="flex gap-2">
            <label htmlFor={inputId} className="sr-only">
              {t.label}
            </label>
            <input
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder={t.placeholder}
              disabled={busy || userTurns >= MAX_ASK_MESSAGES}
              className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-ink placeholder:text-muted"
            />
            <button className="btn btn-primary shrink-0 !px-4" disabled={busy || !input.trim()}>
              {t.send}
            </button>
          </form>
        </>
      )}

      <p className="text-sm text-muted-dark">
        {t.contact}:{" "}
        <a href={`mailto:${CONTACT.email}`} className="underline hover:text-white">
          {CONTACT.email}
        </a>{" "}
        ·{" "}
        <a href={CONTACT.phoneHref} className="underline hover:text-white">
          {CONTACT.phone}
        </a>
      </p>
      <div ref={end} />
    </div>
  );
}

/** Site links in a reply become clickable (same tab); everything else stays plain text. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https:\/\/www\.giftme\.site\/[^\s,;)]*)/);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        // A sentence-ending period is not part of the link.
        const url = p.replace(/\.$/, "");
        return (
          <span key={i}>
            <a href={url.replace(/^https:\/\/www\.giftme\.site/, "")} className="text-red-dark underline">
              {url}
            </a>
            {p.slice(url.length)}
          </span>
        );
      })}
    </>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth={3} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
