"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/catalog";
import type { DemoEvent } from "@/lib/agent-demo";
import { getDict } from "@/i18n";

type ScenarioOption = { id: string; title: string };

const statusColor = (s: number) =>
  s >= 200 && s < 300 ? "bg-green-600" : s === 0 || s >= 500 ? "bg-red" : "bg-yellow-500 text-ink";

export function DemoConsole({ lang, scenarios }: { lang: Locale; scenarios: ScenarioOption[] }) {
  const t = getDict(lang).demo;
  const [scenario, setScenario] = useState(scenarios[0].id);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [events.length]);

  async function run() {
    setEvents([]);
    setError("");
    setRunning(true);
    try {
      const res = await fetch("/api/agent-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, lang }),
      });
      if (!res.ok || !res.body) {
        setError(res.status === 429 ? t.rate : t.failed);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const e = JSON.parse(line) as DemoEvent;
            setEvents((prev) => [...prev, e]);
          } catch {}
        }
      }
    } catch {
      setError(t.failed);
    } finally {
      setRunning(false);
    }
  }

  const start = events.find((e): e is Extract<DemoEvent, { type: "start" }> => e.type === "start");

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-3 font-display text-xl font-black">{t.pick}</legend>
          <div className="space-y-2">
            {scenarios.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${scenario === s.id ? "bg-white text-ink ring-white" : "ring-white/25"}`}
              >
                <input
                  type="radio"
                  name="scenario"
                  value={s.id}
                  checked={scenario === s.id}
                  onChange={() => setScenario(s.id)}
                  disabled={running}
                  className="accent-red"
                />
                <span className="font-medium">{s.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={run} disabled={running} className="btn btn-primary w-full">
          {running ? t.running : events.length ? t.again : t.run} {running ? "" : "▶"}
        </button>
        {error && (
          <p role="alert" className="font-medium text-[#ff8a92]">
            {error}
          </p>
        )}
      </div>

      <section aria-labelledby="log-title" className="min-w-0 rounded-3xl bg-black/40 p-4 ring-1 ring-white/15 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="log-title" className="text-2xl">
            {t.log}
          </h2>
          {start && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              {start.mode === "llm" ? t.llm(start.model ?? "") : t.scripted}
            </span>
          )}
        </div>
        <ol className="mt-4 space-y-3" aria-live="polite">
          {events.length === 0 && <li className="text-muted-dark">{t.empty}</li>}
          {events.map((e, i) => (
            <LogItem key={i} e={e} lang={lang} />
          ))}
          {running && (
            <li className="animate-pulse text-muted-dark" aria-hidden="true">
              ● ● ●
            </li>
          )}
          <li ref={end} aria-hidden="true" />
        </ol>
      </section>
    </div>
  );
}

function LogItem({ e, lang }: { e: DemoEvent; lang: Locale }) {
  const t = getDict(lang).demo;
  if (e.type === "start") {
    return (
      <li className="rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-dark">{t.request}</p>
        <p className="mt-1">“{e.scenario}”</p>
        {e.note && <p className="mt-2 text-sm text-[#ffd27a]">{e.note}</p>}
      </li>
    );
  }
  if (e.type === "say") {
    return (
      <li className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-red text-sm">
          AI
        </span>
        <p className="whitespace-pre-line leading-relaxed">{e.text}</p>
      </li>
    );
  }
  if (e.type === "call") {
    const path = e.url.replace(/^https?:\/\/[^/]+/, "");
    return (
      <li className="rounded-2xl bg-white/5 ring-1 ring-white/10">
        <details>
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 font-mono text-sm">
            <span className="rounded bg-white px-1.5 py-0.5 font-bold text-ink">{e.method}</span>
            <span className="break-all">{path}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-bold text-white ${statusColor(e.status)}`}>{e.status || "ERR"}</span>
            <span className="text-xs text-muted-dark">{e.ms} ms</span>
          </summary>
          <div className="space-y-2 border-t border-white/10 p-3 text-xs">
            {e.body !== undefined && (
              <>
                <p className="text-muted-dark">{t.body}</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/50 p-2">{JSON.stringify(e.body, null, 2)}</pre>
              </>
            )}
            <p className="text-muted-dark">{t.response}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/50 p-2">{pretty(e.preview)}</pre>
          </div>
        </details>
      </li>
    );
  }
  if (e.type === "done") {
    if (!e.orderId) return e.summary ? <li className="rounded-2xl bg-white/5 p-4">{e.summary}</li> : null;
    return (
      <li className="rounded-2xl bg-white p-5 text-ink">
        <p className="font-display text-2xl font-black">{t.doneTitle}</p>
        <dl className="mt-3 grid grid-cols-[100px_1fr] gap-1 text-sm">
          <dt className="text-muted">{t.orderNo}</dt>
          <dd className="font-semibold">{e.orderId}</dd>
          {e.total != null && (
            <>
              <dt className="text-muted">{t.total}</dt>
              <dd className="font-semibold">{e.total} MDL</dd>
            </>
          )}
          {e.status && (
            <>
              <dt className="text-muted">Status</dt>
              <dd>{e.status}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-sm">{t.doneText}</p>
      </li>
    );
  }
  return (
    <li role="alert" className="rounded-2xl bg-red/20 p-3 text-sm">
      {e.message}
    </li>
  );
}

function pretty(text: string) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
