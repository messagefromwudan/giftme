"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CUSTOM_BOX_ID, RULES, type Locale } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { getDict, href } from "@/i18n";
import { QuoteSummary } from "./QuoteSummary";
import { PracticeNotice } from "./PracticeNotice";
import { useQuote } from "./useQuote";

type Form = {
  recipient: string;
  occasion: string;
  engraving: string;
  labels: string;
  perBoxNames: string;
  giftIdea: string;
  zone: "chisinau" | "moldova";
  city: string;
  address: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  payment: "cash" | "transfer";
  code: string;
  notes: string;
  acceptTerms: boolean;
  acceptCustomTerms: boolean;
  website: string;
};

const EMPTY: Form = {
  recipient: "",
  occasion: "",
  engraving: "",
  labels: "",
  perBoxNames: "",
  giftIdea: "",
  zone: "chisinau",
  city: "",
  address: "",
  date: "",
  name: "",
  email: "",
  phone: "",
  payment: "cash",
  code: "",
  notes: "",
  acceptTerms: false,
  acceptCustomTerms: false,
  website: "",
};

const DRAFT_KEY = "giftme-checkout-draft-v1";

export function Checkout({ lang }: { lang: Locale }) {
  const t = getDict(lang).shop;
  const router = useRouter();
  const cart = useCart();
  const [f, setF] = useState<Form>(EMPTY);
  const [appliedCode, setAppliedCode] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [step, setStep] = useState<"form" | "review">("form");
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const startedAt = useRef(0);
  const idemKey = useRef("");

  const hasCustom = cart.items.some((i) => i.boxId === CUSTOM_BOX_ID);
  const boxCount = cart.count;
  const { data, loading } = useQuote(cart.items, { zone: f.zone, code: appliedCode, email: f.email });

  // Restore a draft (without consents or the honeypot) so a reload doesn't lose typing.
  useEffect(() => {
    startedAt.current = Date.now();
    idemKey.current = crypto.randomUUID();
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage
      if (d) setF({ ...EMPTY, ...d, acceptTerms: false, acceptCustomTerms: false, website: "" });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...f, website: "", acceptTerms: false, acceptCustomTerms: false }));
    } catch {}
  }, [f]);

  const HINTED: (keyof Form)[] = ["occasion", "engraving", "labels", "perBoxNames", "giftIdea", "email", ...(hasCustom ? ["date" as const] : [])];
  const inp = (id: keyof Form) => {
    const described = [HINTED.includes(id) && `f-${id}-hint`, errors[id] && `f-${id}-err`].filter(Boolean).join(" ");
    return {
      id: `f-${id}`,
      name: id,
      className: INPUT_CLS,
      "aria-invalid": errors[id] ? true : undefined,
      "aria-describedby": described || undefined,
    };
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  if (cart.items.length === 0) {
    return (
      <div className="rounded-3xl bg-cream p-8 text-center">
        <p className="text-lg">{t.empty}</p>
        <Link href={`${href(lang)}#cutii`} className="btn btn-primary mt-6">
          {t.browse}
        </Link>
      </div>
    );
  }

  function validate(): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    const req = (k: keyof Form, ok: boolean) => {
      if (!ok) e[k] = t.required;
    };
    req("recipient", f.recipient.trim().length >= 1);
    req("address", f.address.trim().length >= 5);
    req("date", Boolean(f.date));
    const dates = data?.deliveryDates;
    if (f.date && dates && (f.date < dates.min || f.date > dates.max)) e.date = t.dateRange(dates.min, dates.max);
    req("name", f.name.trim().length >= 2);
    req("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()));
    req("phone", /^\+?[\d\s()-]{6,20}$/.test(f.phone.trim()));
    req("acceptTerms", f.acceptTerms);
    if (f.zone === "moldova") req("city", f.city.trim().length >= 2);
    if (hasCustom) {
      req("giftIdea", f.giftIdea.trim().length >= 3);
      req("acceptCustomTerms", f.acceptCustomTerms);
      if (f.zone !== "chisinau") e.zone = t.customChisinauOnly;
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`f-${first}`)?.focus();
    return !first;
  }

  async function submit() {
    setSending(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey.current },
        body: JSON.stringify({
          lang,
          items: cart.items,
          buyer: { name: f.name, email: f.email, phone: f.phone },
          recipient: { name: f.recipient },
          personalization: { occasion: f.occasion, engraving: f.engraving, labels: f.labels, perBoxNames: f.perBoxNames },
          delivery: { zone: f.zone, city: f.city, address: f.address, date: f.date },
          payment: f.payment,
          customGift: hasCustom ? { idea: f.giftIdea } : undefined,
          code: appliedCode || undefined,
          notes: f.notes,
          acceptTerms: f.acceptTerms,
          acceptCustomTerms: hasCustom ? f.acceptCustomTerms : undefined,
          website: f.website,
          startedAt: startedAt.current,
        }),
      });
      const json = await res.json();
      if (res.ok && json.order) {
        cart.clear();
        sessionStorage.removeItem(DRAFT_KEY);
        router.push(`${href(lang, "/comanda/trimisa/")}?id=${json.order.id}&t=${json.token}`);
        return;
      }
      setSubmitError(
        json.error === "TOO_FAST"
          ? t.errTooFast
          : json.error === "RATE_LIMITED"
            ? t.errRate
            : json.error === "CHECKOUT_CLOSED"
              ? t.closed
              : json.error === "STORE_UNAVAILABLE"
                ? t.errStore
                : json.error === "INVALID_INPUT" || json.error === "INVALID_DATE"
                  ? t.fixErrors
                  : t.errGeneric,
      );
      if (json.error === "INVALID_INPUT" || json.error === "INVALID_DATE") setStep("form");
    } catch {
      setSubmitError(t.errGeneric);
    } finally {
      setSending(false);
    }
  }

  const codeInfo = data?.code;
  const open = data?.checkoutOpen ?? true;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <PracticeNotice lang={lang} />
        {!open && <p className="rounded-2xl bg-ink p-4 text-white">{t.closed}</p>}

        {step === "form" ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validate()) {
                setStep("review");
                window.scrollTo({ top: 0 });
              }
            }}
            className="space-y-6"
          >
            <Section title={t.s1}>
              <Field id="recipient" label={t.recipient} error={errors.recipient} required>
                <input {...inp("recipient")} value={f.recipient} onChange={(e) => set("recipient", e.target.value)} maxLength={80} autoComplete="off" />
              </Field>
              <Field id="occasion" label={t.occasion} hint={t.occasionHint}>
                <input {...inp("occasion")} value={f.occasion} onChange={(e) => set("occasion", e.target.value)} maxLength={80} />
              </Field>
            </Section>

            <Section title={t.s2}>
              <Field id="engraving" label={t.engraving} hint={t.engravingHint}>
                <input {...inp("engraving")} value={f.engraving} onChange={(e) => set("engraving", e.target.value)} maxLength={60} />
              </Field>
              <Field id="labels" label={t.labels} hint={t.labelsHint}>
                <textarea {...inp("labels")} rows={3} value={f.labels} onChange={(e) => set("labels", e.target.value)} maxLength={600} />
              </Field>
              {boxCount > 1 && (
                <Field id="perBoxNames" label={t.perBoxNames} hint={t.perBoxNamesHint}>
                  <textarea {...inp("perBoxNames")} rows={3} value={f.perBoxNames} onChange={(e) => set("perBoxNames", e.target.value)} maxLength={2000} />
                </Field>
              )}
            </Section>

            {hasCustom && (
              <Section title={t.giftTitle}>
                <Field id="giftIdea" label={t.giftIdea} hint={t.giftHint} error={errors.giftIdea} required>
                  <textarea {...inp("giftIdea")} rows={2} value={f.giftIdea} onChange={(e) => set("giftIdea", e.target.value)} maxLength={300} />
                </Field>
              </Section>
            )}

            <Section title={t.s3}>
              <fieldset>
                <legend className="mb-2 font-medium">{t.zone}</legend>
                <div className="flex flex-wrap gap-3" id="f-zone" tabIndex={-1}>
                  {(["chisinau", "moldova"] as const).map((z) => (
                    <label key={z} className={radioCls(f.zone === z)}>
                      <input type="radio" name="zone" value={z} checked={f.zone === z} onChange={() => set("zone", z)} className="accent-red" />
                      {z === "chisinau" ? t.zoneChisinau : t.zoneMoldova}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">{t.zoneHint}</p>
                {hasCustom && <p className="mt-1 text-sm text-muted">{t.customChisinauOnly}</p>}
                {errors.zone && <p className="mt-1 text-sm font-medium text-red-dark">{errors.zone}</p>}
              </fieldset>
              {f.zone === "moldova" && (
                <Field id="city" label={t.city} error={errors.city} required>
                  <input {...inp("city")} value={f.city} onChange={(e) => set("city", e.target.value)} maxLength={60} autoComplete="address-level2" />
                </Field>
              )}
              <Field id="address" label={t.address} error={errors.address} required>
                <input {...inp("address")} value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={200} autoComplete="street-address" />
              </Field>
              <Field id="date" label={t.date} hint={hasCustom ? t.customLeadHint(RULES.custom.minLeadDays) : undefined} error={errors.date} required>
                <input
                  {...inp("date")}
                  type="date"
                  value={f.date}
                  min={data?.deliveryDates.min}
                  max={data?.deliveryDates.max}
                  onChange={(e) => set("date", e.target.value)}
                />
              </Field>
            </Section>

            <Section title={t.s4}>
              <Field id="name" label={t.name} error={errors.name} required>
                <input {...inp("name")} value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="name" />
              </Field>
              <Field id="email" label={t.email} hint={t.emailHint} error={errors.email} required>
                <input {...inp("email")} type="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={120} autoComplete="email" />
              </Field>
              <Field id="phone" label={t.phone} error={errors.phone} required>
                <input {...inp("phone")} type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} autoComplete="tel" />
              </Field>
            </Section>

            <Section title={t.s5}>
              <div className="flex flex-wrap gap-3">
                {(["cash", "transfer"] as const).map((p) => (
                  <label key={p} className={radioCls(f.payment === p)}>
                    <input type="radio" name="payment" value={p} checked={f.payment === p} onChange={() => set("payment", p)} className="accent-red" />
                    {p === "cash" ? t.cash : t.transfer}
                  </label>
                ))}
              </div>
              {f.payment === "transfer" && <p className="text-sm text-muted">{t.transferHint}</p>}

              <Field id="code" label={t.code}>
                <div className="flex gap-2">
                  <input {...inp("code")} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={40} autoComplete="off" />
                  <button type="button" className="btn btn-ghost shrink-0" onClick={() => setAppliedCode(f.code.trim())}>
                    {t.codeApply}
                  </button>
                </div>
                {appliedCode && codeInfo && (
                  <p className="mt-1 text-sm" role="status">
                    {codeInfo.rejected
                      ? t.codeRejected[codeInfo.rejected] ?? t.codeRejected.not_found
                      : codeInfo.applied
                        ? `✓ ${codeInfo.code}`
                        : t.codeNotBest}
                  </p>
                )}
              </Field>

              <Field id="notes" label={t.notes}>
                <textarea {...inp("notes")} rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
              </Field>

              {/* Honeypot: hidden from people and screen readers; bots tend to fill it. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" name="website" value={f.website} onChange={(e) => set("website", e.target.value)} />
                </label>
              </div>

              <Check id="acceptTerms" checked={f.acceptTerms} onChange={(v) => set("acceptTerms", v)} error={errors.acceptTerms}>
                {t.terms}{" "}
                <a href={href(lang, "/termeni/")} target="_blank" className="underline">
                  {t.termsLink}
                </a>{" "}
                {t.and}{" "}
                <a href={href(lang, "/confidentialitate/")} target="_blank" className="underline">
                  {t.privacyLink}
                </a>
                .
              </Check>
              {hasCustom && (
                <Check id="acceptCustomTerms" checked={f.acceptCustomTerms} onChange={(v) => set("acceptCustomTerms", v)} error={errors.acceptCustomTerms}>
                  {t.customTerms}{" "}
                  <a href={`${href(lang, "/termeni/")}#gm-09`} target="_blank" className="underline">
                    {t.customTermsLink}
                  </a>
                  .
                </Check>
              )}
            </Section>

            {Object.values(errors).some(Boolean) && (
              <p role="alert" className="font-medium text-red-dark">
                {t.fixErrors}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              {t.review} →
            </button>
          </form>
        ) : (
          <Review lang={lang} f={f} hasCustom={hasCustom} onEdit={() => setStep("form")}>
            {submitError && (
              <p role="alert" className="font-medium text-red-dark">
                {submitError}
              </p>
            )}
            <button type="button" className="btn btn-primary w-full" disabled={sending || !open} onClick={submit}>
              {sending ? t.sending : t.confirm}
            </button>
          </Review>
        )}
      </div>

      <aside className="h-fit rounded-3xl bg-cream p-6 lg:sticky lg:top-24">
        <QuoteSummary lang={lang} quote={data?.quote ?? null} loading={loading} showFreeHint={f.zone === "chisinau"} />
      </aside>
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-black/25 bg-white px-4 py-3 text-base outline-none focus:border-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-red";

const radioCls = (on: boolean) =>
  `flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-4 ${on ? "border-ink bg-white font-semibold" : "border-black/25"}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-3xl p-5 ring-1 ring-black/10 sm:p-6">
      <legend className="px-2 font-display text-2xl font-black">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`f-${id}`} className="mb-1 block font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-red-dark"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={`f-${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`f-${id}-err`} className="mt-1 text-sm font-medium text-red-dark">
          {error}
        </p>
      )}
    </div>
  );
}

function Check({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="flex items-start gap-3">
        <input
          id={`f-${id}`}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 size-5 accent-red"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `f-${id}-err` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`f-${id}-err`} className="mt-1 text-sm font-medium text-red-dark">
          {error}
        </p>
      )}
    </div>
  );
}

function Review({
  lang,
  f,
  hasCustom,
  onEdit,
  children,
}: {
  lang: Locale;
  f: Form;
  hasCustom: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  const t = getDict(lang).shop;
  const rows: [string, string][] = [
    [t.recipient, f.recipient],
    [t.occasion, f.occasion],
    [t.engraving, f.engraving],
    [t.labels, f.labels],
    [t.perBoxNames, f.perBoxNames],
    ...(hasCustom ? [[t.giftIdea, f.giftIdea] as [string, string]] : []),
    [t.s3, `${f.zone === "chisinau" ? t.zoneChisinau : f.city} · ${f.address} · ${f.date}`],
    [t.s4, `${f.name} · ${f.email} · ${f.phone}`],
    [t.s5, f.payment === "cash" ? t.cash : `${t.transfer}. ${t.transferHint}`],
    [t.notes, f.notes],
  ];
  return (
    <section aria-labelledby="review-title" className="space-y-5 rounded-3xl p-6 ring-1 ring-black/10">
      <div className="flex items-center justify-between gap-4">
        <h2 id="review-title" className="text-2xl">
          {t.reviewTitle}
        </h2>
        <button type="button" onClick={onEdit} className="text-sm font-semibold underline">
          {t.edit}
        </button>
      </div>
      <dl className="divide-y divide-black/10">
        {rows
          .filter(([, v]) => v.trim())
          .map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2 sm:grid-cols-[200px_1fr]">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="whitespace-pre-line break-words">{v}</dd>
            </div>
          ))}
      </dl>
      {children}
    </section>
  );
}
