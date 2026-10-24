"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, newSessionValue, passwordMatches, requireAdmin } from "@/lib/admin-auth";
import { getOrder, patchOrder, setGiftQuote, updateStatus, type GiftQuoteStatus } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/status";
import { giftQuote, send, sendStatusEmail } from "@/lib/emails";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";

export async function login(_: unknown, form: FormData): Promise<{ error?: string }> {
  const wait = await rateLimit(LIMITS.adminLogin, clientIp(await headers()));
  if (wait) return { error: `Prea multe încercări. Încearcă din nou peste ${Math.ceil(wait / 60)} min.` };
  if (!passwordMatches(String(form.get("password") ?? ""))) return { error: "Parolă greșită." };
  // Return to the page the link pointed at (e.g. "Deschide în admin" in an email); admin paths only.
  const next = String(form.get("next") ?? "");
  const target = /^\/admin\/(comenzi\/GM-\d{1,9}\/)?$/.test(next) ? next : "/admin/";
  const s = newSessionValue();
  (await cookies()).set(ADMIN_COOKIE, s.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: s.maxAge,
  });
  redirect(target);
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/");
}

async function loadOrder(form: FormData) {
  await requireAdmin();
  const order = await getOrder(String(form.get("id") ?? ""));
  if (!order) throw new Error("NOT_FOUND");
  return order;
}

export async function changeStatus(form: FormData) {
  const order = await loadOrder(form);
  const status = String(form.get("status")) as OrderStatus;
  // "awaiting_approval" → "received" only happens when the BUYER approves (human-in-the-loop).
  if (!ORDER_STATUSES.includes(status) || status === "awaiting_approval") return;
  if (order.status === "awaiting_approval" && status !== "cancelled") return;
  const before = order.status;
  await updateStatus(order, status, "admin", String(form.get("note") ?? "").slice(0, 200) || undefined);
  if (before !== status && form.get("notify") === "on") {
    const r = await sendStatusEmail(order);
    await patchOrder(order, (o) => (o.emails.status = r));
  }
  revalidatePath("/admin");
}

export async function quoteGift(form: FormData) {
  const order = await loadOrder(form);
  const amount = Number(form.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return;
  await setGiftQuote(order, amount, "admin");
  if (form.get("notify") === "on") {
    const q = giftQuote(order);
    const r = await send(order.buyer.email, q.subject, q.html);
    await patchOrder(order, (o) => (o.emails.status = r));
  }
  revalidatePath("/admin");
}

export async function giftStep(form: FormData) {
  const order = await loadOrder(form);
  const step = String(form.get("step")) as GiftQuoteStatus | "coordinator";
  await patchOrder(order, (o) => {
    if (!o.customGift) return;
    if (step === "coordinator") o.customGift.coordinatorApproved = true;
    // Never "buy" before payment, and never above the cap without coordinator approval.
    if (step === "paid" && o.customGift.status === "quoted") o.customGift.status = "paid";
    if (
      step === "bought" &&
      o.customGift.status === "paid" &&
      (!o.customGift.needsCoordinatorApproval || o.customGift.coordinatorApproved)
    )
      o.customGift.status = "bought";
    o.history.push({ status: o.status, at: new Date().toISOString(), by: "admin", note: `GM-09: ${step}` });
  });
  revalidatePath("/admin");
}
