import Link from "next/link";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { STATUS_LABEL, type OrderStatus } from "@/lib/status";
import { logout } from "./actions";
import { LoginForm } from "./LoginForm";

export const STATUS_STYLE: Record<OrderStatus, string> = {
  awaiting_approval: "bg-yellow-100 text-yellow-900",
  received: "bg-blue-100 text-blue-900",
  preparing: "bg-orange-100 text-orange-900",
  delivered: "bg-green-100 text-green-900",
  cancelled: "bg-gray-200 text-gray-700",
};

/** Team-facing wording; the customer-facing labels live in lib/status.ts. */
export const adminLabel = (s: OrderStatus) =>
  s === "awaiting_approval" ? "Așteaptă confirmarea clientului" : STATUS_LABEL[s].ro;

export const chisinauTime = (iso: string) =>
  new Intl.DateTimeFormat("ro-MD", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Chisinau" }).format(
    new Date(iso),
  );

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {adminLabel(status)}
    </span>
  );
}

/** Friendly message when the database can't be reached (paused project, outage, missing settings). */
export function AdminProblem({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="alert" className="space-y-2 rounded-2xl bg-yellow-100 p-5">
      <p className="font-display text-xl font-black">{title}</p>
      {children && <div className="text-sm">{children}</div>}
      <Link href="/admin/" className="inline-block text-sm underline">
        ← Toate comenzile
      </Link>
    </div>
  );
}

export const STORAGE_PROBLEM = (
  <>
    Nu ne putem conecta acum la baza de date, așa că lista de comenzi nu poate fi afișată. Încearcă din nou
    peste un minut. Dacă problema continuă, verifică în Supabase că proiectul GiftMe este activ și în Vercel că{" "}
    <code>SUPABASE_URL</code> și <code>SUPABASE_SERVICE_ROLE_KEY</code> sunt setate pentru acest mediu.
  </>
);

/** Loads admin data; storage failures become a message instead of crashing the page. */
export async function loadOrProblem<T>(load: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await load() };
  } catch (e) {
    unstable_rethrow(e);
    console.error("[admin] storage error", e);
    return { ok: false };
  }
}

/** Renders the login form instead of `children` until the admin is signed in. */
export async function AdminGate({ children }: { children: ReactNode }) {
  // Request time only: env and cookies must never be baked into the prerendered shell.
  await connection();
  if (!adminConfigured()) {
    return (
      <p className="rounded-2xl bg-cream p-6">
        Panoul de administrare nu este activ: setați variabila <code>ADMIN_PASSWORD</code> (minimum 10 caractere) în
        Vercel → Settings → Environment Variables și refaceți deploy-ul.
      </p>
    );
  }
  if (!(await isAdmin())) return <LoginForm />;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/" className="font-display text-2xl font-black">
          Comenzi GiftMe!
        </Link>
        <form action={logout}>
          <button className="text-sm underline">Ieșire</button>
        </form>
      </div>
      {children}
    </>
  );
}
