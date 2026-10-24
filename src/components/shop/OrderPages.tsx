"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/catalog";
import type { Quote } from "@/lib/pricing";
import { STATUS_LABEL, type OrderStatus } from "@/lib/status";
import { getDict, href } from "@/i18n";
import { QuoteSummary } from "./QuoteSummary";
import { PracticeNotice } from "./PracticeNotice";

/** Mirrors publicOrder() in lib/http.ts. */
export type PublicOrder = {
  id: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  history: { status: string; at: string }[];
  recipient: string;
  delivery: { date: string; zone: string; city: string };
  payment: "cash" | "transfer";
  quote: Quote;
  customGift?: { idea: string; status: string; amount?: number };
  referralCode?: string;
};

async function fetchOrder(body: object): Promise<{ order?: PublicOrder; error?: string }> {
  try {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { error: "NETWORK" };
  }
}

const fmt = (iso: string, lang: Locale) =>
  new Intl.DateTimeFormat(lang === "ro" ? "ro-MD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Chisinau",
  }).format(new Date(iso));

export function OrderCard({ lang, order, token }: { lang: Locale; order: PublicOrder; token?: string }) {
  const t = getDict(lang).shop;
  const canRecord = token && order.status !== "awaiting_approval" && order.status !== "cancelled";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5 rounded-3xl p-6 ring-1 ring-black/10">
        <div>
          <p className="text-sm text-muted">{t.orderNo}</p>
          <p className="font-display text-4xl font-black">{order.id}</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t.status}</p>
          <p className="mt-1 inline-block rounded-full bg-ink px-4 py-1.5 font-semibold text-white">{order.statusLabel}</p>
        </div>
        <dl className="grid gap-2 text-[0.95rem] sm:grid-cols-[160px_1fr]">
          <dt className="text-muted">{t.recipient}</dt>
          <dd>{order.recipient}</dd>
          <dt className="text-muted">{t.date}</dt>
          <dd>
            {order.delivery.date} · {order.delivery.zone === "chisinau" ? t.zoneChisinau : order.delivery.city}
          </dd>
          <dt className="text-muted">{t.s5}</dt>
          <dd>{order.payment === "cash" ? t.cash : `${t.transfer}. ${t.transferHint}`}</dd>
          {order.customGift && (
            <>
              <dt className="text-muted">{t.giftQuote}</dt>
              <dd>
                {order.customGift.idea} ·{" "}
                {order.customGift.amount != null ? `${order.customGift.amount} MDL` : t.giftAwaiting}
              </dd>
            </>
          )}
        </dl>
        <div>
          <p className="text-sm text-muted">{t.history}</p>
          <ol className="mt-2 space-y-1 text-sm">
            {order.history.map((h, i) => (
              <li key={i}>
                {fmt(h.at, lang)} · {STATUS_LABEL[h.status as OrderStatus]?.[lang] ?? h.status}
              </li>
            ))}
          </ol>
        </div>
        {canRecord && (
          <Link href={`${href(lang, "/mesaj/nou/")}?id=${order.id}&t=${token}`} className="btn btn-primary">
            🎙 {getDict(lang).msg.recordCta}
          </Link>
        )}
        {order.referralCode && (
          <div className="rounded-2xl bg-blush p-4">
            <p className="text-sm text-muted">{t.yourCode}</p>
            <p className="font-display text-2xl font-black tracking-wide">{order.referralCode}</p>
            <p className="mt-1 text-sm">{t.yourCodeText}</p>
          </div>
        )}
      </div>
      <aside className="h-fit space-y-4 rounded-3xl bg-cream p-6">
        <QuoteSummary lang={lang} quote={order.quote} showFreeHint={false} />
        <PracticeNotice lang={lang} compact />
      </aside>
    </div>
  );
}

export function ThankYou({ lang }: { lang: Locale }) {
  const t = getDict(lang).shop;
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const token = sp.get("t") ?? "";
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetchOrder({ id, token }).then((r) => {
      if (!live) return;
      if (r.order) setOrder(r.order);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [id, token]);

  return (
    <div className="space-y-6">
      <div>
        <p className="hand text-4xl text-red">{getDict(lang).hero.tag}</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{t.thanksTitle}</h1>
        <p className="mt-3 text-lg text-muted">{t.thanksText}</p>
      </div>
      {order && <OrderCard lang={lang} order={order} token={token} />}
      {failed && <p>{t.notFound}</p>}
      <Link href={`${href(lang, "/urmarire/")}?id=${id}&t=${token}`} className="btn btn-ghost">
        {t.track}
      </Link>
    </div>
  );
}

export function Track({ lang }: { lang: Locale }) {
  const t = getDict(lang).shop;
  const sp = useSearchParams();
  const [id, setId] = useState(sp.get("id") ?? "");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [msg, setMsg] = useState("");
  const token = sp.get("t");

  useEffect(() => {
    const qid = sp.get("id");
    if (!qid || !token) return;
    let live = true;
    fetchOrder({ id: qid, token }).then((r) => {
      if (!live) return;
      if (r.order) setOrder(r.order);
      else setMsg(t.notFound);
    });
    return () => {
      live = false;
    };
  }, [sp, token, t.notFound]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await fetchOrder({ id: id.trim().toUpperCase(), email: email.trim() });
    if (r.order) setOrder(r.order);
    else setMsg(r.error === "RATE_LIMITED" ? t.errRate : t.notFound);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl sm:text-5xl">{t.trackTitle}</h1>
      {!order && (
        <form onSubmit={onSubmit} className="max-w-lg space-y-4 rounded-3xl p-6 ring-1 ring-black/10">
          <p className="text-muted">{t.trackIntro}</p>
          <div>
            <label htmlFor="track-id" className="mb-1 block font-medium">
              {t.orderId}
            </label>
            <input
              id="track-id"
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="GM-1001"
              className="w-full rounded-xl border border-black/25 px-4 py-3"
            />
          </div>
          <div>
            <label htmlFor="track-email" className="mb-1 block font-medium">
              {t.email}
            </label>
            <input
              id="track-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-black/25 px-4 py-3"
            />
          </div>
          <button className="btn btn-primary">{t.find}</button>
        </form>
      )}
      {msg && <p role="alert">{msg}</p>}
      {order && <OrderCard lang={lang} order={order} token={token ?? undefined} />}
    </div>
  );
}

async function approvalCall(body: object): Promise<{ order?: PublicOrder; already?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/orders/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { error: "NETWORK" };
  }
}

export function Approve({ lang }: { lang: Locale }) {
  const t = getDict(lang).shop;
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const approvalToken = sp.get("a") ?? "";
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    approvalCall({ id, approvalToken, action: "view" }).then((r) => {
      if (!live) return;
      if (r.order) setOrder(r.order);
      else setMsg(t.notFound);
    });
    return () => {
      live = false;
    };
  }, [id, approvalToken, t.notFound]);

  async function approve() {
    setBusy(true);
    try {
      const json = await approvalCall({ id, approvalToken, action: "approve" });
      if (json.order) {
        setOrder(json.order);
        setMsg(json.already ? t.alreadyApproved : t.approved);
      } else setMsg(t.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl sm:text-5xl">{t.approveTitle}</h1>
      <p className="text-lg text-muted">{t.approveText}</p>
      {order && <OrderCard lang={lang} order={order} />}
      {order?.status === "awaiting_approval" && (
        <button type="button" className="btn btn-primary" onClick={approve} disabled={busy}>
          {busy ? t.sending : t.approveButton}
        </button>
      )}
      {msg && (
        <p role="status" className="font-medium">
          {msg}
        </p>
      )}
    </div>
  );
}
