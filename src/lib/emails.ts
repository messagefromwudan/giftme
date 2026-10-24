import "server-only";
import nodemailer from "nodemailer";
import { RULES, SITE, type Locale } from "./catalog";
import { orderBaseUrl } from "./origin";
import { STATUS_LABEL, type Order } from "./orders";

// Sends through the fe.giftme@gmail.com account (SMTP_USER + a Gmail app password in SMTP_PASS).
// Without credentials, emails are logged instead of sent and the order is still saved.

export type SendResult = "sent" | "skipped" | `error: ${string}`;

const ADMIN_TO = () => process.env.ORDER_NOTIFY_TO || SITE.email;
const FROM = () => process.env.MAIL_FROM || `GiftMe! <${process.env.SMTP_USER || SITE.email}>`;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

export async function send(to: string, subject: string, html: string, replyTo?: string): Promise<SendResult> {
  const t = getTransport();
  if (!t) {
    console.info(`[email skipped: SMTP not configured] to=${to} subject=${subject}`);
    return "skipped";
  }
  try {
    await t.sendMail({ from: FROM(), to, subject, html, replyTo: replyTo ?? SITE.email });
    return "sent";
  } catch (e) {
    console.error("[email error]", e);
    return `error: ${(e as Error).message.slice(0, 120)}`;
  }
}

// ---------- Templates ----------

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

const T = {
  ro: {
    practice:
      "Aceasta este o <strong>comandă de exercițiu</strong> a firmei de exercițiu FE GiftMe SRL (CEEF Chișinău): nu se face nicio plată reală și nu se livrează bunuri reale.",
    thanks: (name: string) => `Mulțumim, ${name}!`,
    received: "Am primit comanda ta. Iată rezumatul:",
    subtotal: "Subtotal",
    delivery: "Livrare",
    free: "gratuită",
    total: "Total",
    giftPending: "Cadoul YOUR BOX (GM-09) îl cotează echipa noastră; îți trimitem prețul prin email. Îl cumpărăm doar după ce plătești cotația.",
    payCash: "Plată: numerar la livrare.",
    payTransfer: "Plată: transfer bancar. Îți trimitem detaliile de plată prin email.",
    track: "Urmărește comanda",
    record: "Înregistrează mesajul pentru codul QR",
    recordText: "Înregistrează un mesaj audio sau video (sau scrie un text) pentru codul QR de pe cutie. E gratuit.",
    deliveryTo: "Livrare",
    referral: (code: string) =>
      `Codul tău REFER A FRIEND: <strong>${esc(code)}</strong>. Prietenul tău primește −50 MDL la prima comandă, iar tu −50 MDL la următoarea ta comandă.`,
    statusSubject: (id: string, s: string) => `Comanda ${id}: ${s}`,
    statusBody: (s: string) => `Statusul comenzii tale s-a schimbat: <strong>${esc(s)}</strong>.`,
    approveSubject: (id: string) => `Confirmă comanda ${id} plasată de asistentul tău AI`,
    approveBody:
      "Un asistent AI a pregătit această comandă în numele tău. Nu o procesăm până nu o confirmi tu. Dacă nu ai cerut-o, ignoră acest email.",
    approveCta: "Confirm comanda",
    contact: "Întrebări? Scrie-ne la",
  },
  en: {
    practice:
      "This is a <strong>practice-company order</strong> of FE GiftMe SRL (CEEF Chișinău): no real payment is made and no real goods are delivered.",
    thanks: (name: string) => `Thank you, ${name}!`,
    received: "We received your order. Here's the summary:",
    subtotal: "Subtotal",
    delivery: "Delivery",
    free: "free",
    total: "Total",
    giftPending: "Our team will quote the YOUR BOX (GM-09) gift and email you the price. We buy it only after you pay the quote.",
    payCash: "Payment: cash on delivery.",
    payTransfer: "Payment: bank transfer. We'll email you the payment details.",
    track: "Track your order",
    record: "Record your message for the QR code",
    recordText: "Record an audio or video message (or write a text) for the QR code on the box. It's free.",
    deliveryTo: "Delivery",
    referral: (code: string) =>
      `Your REFER A FRIEND code: <strong>${esc(code)}</strong>. Your friend gets −50 MDL on their first order, and you get −50 MDL on your next one.`,
    statusSubject: (id: string, s: string) => `Order ${id}: ${s}`,
    statusBody: (s: string) => `Your order status changed to: <strong>${esc(s)}</strong>.`,
    approveSubject: (id: string) => `Confirm order ${id} placed by your AI assistant`,
    approveBody:
      "An AI assistant prepared this order on your behalf. We won't process it until you confirm it. If you didn't ask for it, ignore this email.",
    approveCta: "Confirm the order",
    contact: "Questions? Write to",
  },
} satisfies Record<Locale, unknown>;

const base = (o: Order) => orderBaseUrl(o.siteOrigin);
const langPrefix = (lang: Locale) => (lang === "en" ? "/en" : "");
export const recordUrl = (o: Order) => `${base(o)}${langPrefix(o.lang)}/mesaj/nou/?id=${o.id}&t=${o.token}`;
export const adminUrl = (o: Order) => `${base(o)}/admin/comenzi/${o.id}/`;
export const trackUrl = (o: Order) => `${base(o)}${langPrefix(o.lang)}/urmarire/?id=${o.id}&t=${o.token}`;
export const approveUrl = (o: Order) =>
  `${base(o)}${langPrefix(o.lang)}/confirma-comanda/?id=${o.id}&a=${o.approvalToken}`;

function layout(body: string) {
  return `<!doctype html><html><body style="margin:0;background:#fbf6f1;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:24px;font-weight:900;margin:0 0 16px">Gift<span style="color:#e11d2e">Me!</span></p>
<div style="background:#fff;border-radius:16px;padding:24px">${body}</div>
<p style="font-size:12px;color:#5b5b5b;margin-top:16px">FE GiftMe SRL · ${SITE.email} · ${SITE.phoneDisplay} · giftme.site</p>
</div></body></html>`;
}

const btn = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#e11d2e;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${esc(label)}</a></p>`;

const notice = (lang: Locale) =>
  `<p style="background:#fdeced;border-radius:12px;padding:12px;font-size:14px">${T[lang].practice}</p>`;

function summary(o: Order) {
  const t = T[o.lang];
  const q = o.quote;
  const rows = q.lines
    .map((l) => `<tr><td>${l.quantity} × ${esc(l.name)} (${l.boxId})</td><td align="right">${l.lineTotal} MDL</td></tr>`)
    .join("");
  const offer = q.offer
    ? `<tr><td>${esc(q.offer.name)}</td><td align="right">−${q.offer.discount} MDL</td></tr>`
    : "";
  const del = q.delivery.fee === 0 ? t.free : `${q.delivery.fee} MDL`;
  return `<table width="100%" cellpadding="4" style="border-collapse:collapse;font-size:14px">
${rows}
<tr><td>${t.subtotal}</td><td align="right">${q.subtotal} MDL</td></tr>${offer}
<tr><td>${t.delivery}</td><td align="right">${del}</td></tr>
<tr><td><strong>${t.total}</strong></td><td align="right"><strong>${q.total} MDL</strong></td></tr></table>
${q.customGiftPending ? `<p style="font-size:14px">${t.giftPending}</p>` : ""}`;
}

export function customerConfirmation(o: Order) {
  const t = T[o.lang];
  const body = `${notice(o.lang)}
<h1 style="font-size:22px">${esc(t.thanks(o.buyer.name.split(" ")[0]))}</h1>
<p>${t.received} <strong>${o.id}</strong></p>
${summary(o)}
<p style="font-size:14px">${o.payment === "cash" ? t.payCash : t.payTransfer}</p>
<p style="font-size:14px">${t.deliveryTo}: ${esc(o.delivery.date)} · ${esc(o.delivery.address)}${o.delivery.city ? `, ${esc(o.delivery.city)}` : ""}</p>
<p style="font-size:14px">${t.recordText}</p>
${btn(recordUrl(o), t.record)}
<p style="font-size:14px"><a href="${esc(trackUrl(o))}">${t.track}</a></p>
${o.referralCode ? `<p style="font-size:14px">${t.referral(o.referralCode)}</p>` : ""}
<p style="font-size:14px">${t.contact} ${SITE.email}.</p>`;
  return { subject: `GiftMe! ${o.id} · ${o.lang === "ro" ? "comandă de exercițiu" : "practice order"}`, html: layout(body) };
}

export function approvalRequest(o: Order) {
  const t = T[o.lang];
  const body = `${notice(o.lang)}<h1 style="font-size:22px">${t.approveSubject(o.id)}</h1>
<p>${t.approveBody}</p>${summary(o)}${btn(approveUrl(o), t.approveCta)}`;
  return { subject: t.approveSubject(o.id), html: layout(body) };
}

export function giftQuote(o: Order) {
  const amount = o.customGift?.amount ?? 0;
  const ro = o.lang === "ro";
  const body = `${notice(o.lang)}<h1 style="font-size:22px">${ro ? "Cotația cadoului tău" : "Your gift quote"} · ${o.id}</h1>
<p>${ro ? "Cadoul ales" : "Your chosen gift"}: <strong>${esc(o.customGift?.idea ?? "")}</strong></p>
<p style="font-size:20px"><strong>${amount} MDL</strong> ${ro ? "(fără alte taxe)" : "(no extra fees)"}</p>
<p>${ro ? "Cumpărăm cadoul doar după ce confirmi plata. Îți trimitem detaliile de plată prin email; răspunde la acest mesaj dacă ai întrebări sau vrei să anulezi (gratuit, înainte de cumpărare)." : "We buy the gift only after you confirm payment. We'll email you the payment details; reply to this message with questions, or to cancel (free, before the gift is bought)."}</p>
${btn(trackUrl(o), T[o.lang].track)}`;
  return { subject: `${o.id}: ${ro ? "cotația cadoului" : "gift quote"} ${amount} MDL`, html: layout(body) };
}

export function statusUpdate(o: Order) {
  const t = T[o.lang];
  const label = STATUS_LABEL[o.status][o.lang];
  const body = `${notice(o.lang)}<p>${o.id}</p><p>${t.statusBody(label)}</p>${btn(trackUrl(o), t.track)}`;
  return { subject: t.statusSubject(o.id, label), html: layout(body) };
}

/** Internal notification for the team. Customer text is escaped and shown as data only. */
export function adminNotification(o: Order) {
  const p = o.personalization;
  const field = (k: string, v?: string) => (v ? `<tr><td valign="top"><strong>${k}</strong></td><td>${nl2br(v)}</td></tr>` : "");
  const body = `<p style="background:#fdeced;border-radius:12px;padding:12px;font-size:14px">Comandă de exercițiu · sursa: <strong>${o.source}</strong> · status: <strong>${STATUS_LABEL[o.status].ro}</strong></p>
<h1 style="font-size:22px">${o.id} · ${o.quote.total} MDL</h1>
${summary({ ...o, lang: "ro" })}
<table cellpadding="4" style="font-size:14px">
${field("Cumpărător", `${o.buyer.name} · ${o.buyer.email} · ${o.buyer.phone}`)}
${field("Destinatar", o.recipient.name)}
${field("Ocazie", p.occasion)}
${field("Gravare", p.engraving)}
${field("Etichete", p.labels)}
${field("Nume pe cutii", p.perBoxNames)}
${field("Livrare", `${o.delivery.date} · ${o.delivery.zone === "chisinau" ? "Chișinău" : o.delivery.city} · ${o.delivery.address}`)}
${field("Plată", o.payment === "cash" ? "numerar la livrare" : "transfer bancar (trimitem detaliile)")}
${field("Cod", o.code ? `${o.code.code} · ${o.code.applied ? "aplicat" : `neaplicat${o.code.rejected ? ` (${o.code.rejected})` : ""}`}` : "")}
${field("Cadou GM-09", o.customGift?.idea)}
${field("Note client", o.notes)}
</table>
${o.customGift ? `<p style="font-size:14px">GM-09: trimiteți cotația din panoul de administrare. Peste ${RULES.custom.maxGiftValueWithoutApproval} MDL e nevoie de aprobarea coordonatorului.</p>` : ""}
${btn(adminUrl(o), "Deschide în admin")}`;
  return { subject: `Comandă nouă ${o.id} · ${o.quote.total} MDL · ${o.source}`, html: layout(body) };
}

export async function sendOrderEmails(o: Order) {
  const admin = adminNotification(o);
  const results: Order["emails"] = { admin: await send(ADMIN_TO(), admin.subject, admin.html, o.buyer.email) };
  if (o.status === "awaiting_approval") {
    const a = approvalRequest(o);
    results.approval = await send(o.buyer.email, a.subject, a.html);
  } else {
    const c = customerConfirmation(o);
    results.customer = await send(o.buyer.email, c.subject, c.html);
  }
  return results;
}

export async function sendStatusEmail(o: Order) {
  const s = statusUpdate(o);
  return send(o.buyer.email, s.subject, s.html);
}

