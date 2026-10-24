import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listOrders } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/status";
import { dbConfigured } from "@/lib/db";
import { AdminGate, StatusBadge, adminLabel, chisinauTime } from "./ui";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage({ searchParams }: PageProps<"/[lang]/admin">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p>Se încarcă…</p>}>
        <AdminGate>
          <Orders searchParams={searchParams} />
        </AdminGate>
      </Suspense>
    </main>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/[lang]/admin">["searchParams"] }) {
  const sp = await searchParams;
  const filter = typeof sp.status === "string" && (ORDER_STATUSES as string[]).includes(sp.status) ? (sp.status as OrderStatus) : null;
  const all = await listOrders(1000);
  const orders = filter ? all.filter((o) => o.status === filter) : all;
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, all.filter((o) => o.status === s).length]));
  const total = all.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.quote.total, 0);

  return (
    <div className="space-y-6">
      {!dbConfigured() && (
        <p className="rounded-2xl bg-yellow-100 p-4 text-sm">
          Baza de date nu este conectată: comenzile sunt ținute doar în memorie (doar pentru test local).
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Comenzi" value={all.length} />
        <Stat label="Valoare (fără anulate)" value={`${total} MDL`} />
        <Stat label="De pregătit" value={counts.received} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/" className={pill(!filter)}>
          Toate ({all.length})
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/admin/?status=${s}`} className={pill(filter === s)}>
            {adminLabel(s)} ({counts[s]})
          </Link>
        ))}
        <span className="grow" />
        <form action="/api/admin/export" method="get" className="flex gap-2">
          <button name="format" value="xlsx" className="btn btn-primary !min-h-10 !py-2 text-sm">
            Export XLSX
          </button>
          <button name="format" value="csv" className="btn btn-ghost !min-h-10 !py-2 text-sm">
            Export CSV
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl bg-cream p-6">Nicio comandă încă.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-black/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-cream">
              <tr>
                {["Nr.", "Data", "Client", "Cutii", "Total", "Livrare", "Status", "Sursa"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-blush/50">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/admin/comenzi/${o.id}/`} className="underline">
                      {o.id}
                    </Link>
                    {o.customGift && <span className="ml-1 rounded bg-red px-1 text-xs text-white">GM-09</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{chisinauTime(o.createdAt)}</td>
                  <td className="px-3 py-2">{o.buyer.name}</td>
                  <td className="px-3 py-2">{o.quote.lines.map((l) => `${l.quantity}×${l.boxId}`).join(", ")}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.quote.total} MDL</td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.delivery.date}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2 text-muted">{o.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const pill = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-medium ${on ? "bg-ink text-white" : "ring-1 ring-black/15 hover:bg-cream"}`;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-cream p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl font-black">{value}</p>
    </div>
  );
}
