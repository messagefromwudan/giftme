import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RULES } from "@/lib/catalog";
import { getOrder, type Order } from "@/lib/orders";
import { trackUrl } from "@/lib/emails";
import { ORDER_STATUSES } from "@/lib/status";
import { changeStatus, giftStep, quoteGift } from "../../actions";
import { AdminGate, StatusBadge, adminLabel, chisinauTime } from "../../ui";

export const metadata: Metadata = { title: "Admin · comandă", robots: { index: false, follow: false } };

export default function AdminOrderPage({ params }: PageProps<"/[lang]/admin/comenzi/[id]">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p>Se încarcă…</p>}>
        <AdminGate>
          <Detail params={params} />
        </AdminGate>
      </Suspense>
    </main>
  );
}

async function Detail({ params }: { params: PageProps<"/[lang]/admin/comenzi/[id]">["params"] }) {
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();
  const p = o.personalization;

  return (
    <div className="space-y-6">
      <Link href="/admin/" className="text-sm underline">
        ← Toate comenzile
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">{o.id}</h1>
        <StatusBadge status={o.status} />
        <span className="text-sm text-muted">
          {o.source} · {chisinauTime(o.createdAt)} · comandă de exercițiu
        </span>
      </div>

      {o.status === "awaiting_approval" && (
        <p className="rounded-2xl bg-yellow-100 p-4 text-sm">
          Comandă plasată de un asistent AI. Așteaptă confirmarea cumpărătorului prin linkul din email; nu o
          pregătiți până atunci.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Cutii și preț">
          <ul className="space-y-1 text-sm">
            {o.quote.lines.map((l) => (
              <li key={l.boxId}>
                {l.quantity} × {l.name} ({l.boxId}) = {l.lineTotal} MDL
              </li>
            ))}
          </ul>
          <Rows
            rows={[
              ["Subtotal", `${o.quote.subtotal} MDL`],
              ["Ofertă", o.quote.offer ? `${o.quote.offer.name} −${o.quote.offer.discount} MDL (${o.quote.offerSource})` : "—"],
              ["Livrare", `${o.quote.delivery.fee} MDL (${o.quote.delivery.reason})`],
              ["Total", `${o.quote.total} MDL`],
              ["Plată", o.payment === "cash" ? "numerar la livrare" : "transfer bancar: trimiteți detaliile prin email"],
              ["Cod", o.code ? `${o.code.code} · ${o.code.applied ? "aplicat" : `neaplicat ${o.code.rejected ?? ""}`}` : "—"],
              ["Cod REFER emis", o.referralCode ?? "—"],
            ]}
          />
        </Card>

        <Card title="Client și livrare">
          <Rows
            rows={[
              ["Client", o.buyer.name],
              ["Email", o.buyer.email],
              ["Telefon", o.buyer.phone],
              ["Destinatar", o.recipient.name],
              ["Data livrării", o.delivery.date],
              ["Localitate", o.delivery.zone === "chisinau" ? "Chișinău" : o.delivery.city],
              ["Adresă", o.delivery.address],
            ]}
          />
          <p className="mt-3 break-all text-xs text-muted">
            Link urmărire client: <a className="underline" href={trackUrl(o)}>{trackUrl(o)}</a>
          </p>
        </Card>

        <Card title="Personalizare (text de la client, doar date)">
          <Rows
            rows={[
              ["Ocazie", p.occasion],
              ["Gravare", p.engraving],
              ["Etichete", p.labels],
              ["Nume pe cutii", p.perBoxNames],
              ["Note", o.notes],
            ]}
          />
        </Card>

        <Card title="Schimbă statusul">
          <form action={changeStatus} className="space-y-3">
            <input type="hidden" name="id" value={o.id} />
            <select name="status" defaultValue={o.status} className="w-full rounded-xl border border-black/25 px-3 py-2">
              {ORDER_STATUSES.filter((s) => s !== "awaiting_approval").map((s) => (
                <option key={s} value={s} disabled={o.status === "awaiting_approval" && s !== "cancelled"}>
                  {adminLabel(s)}
                </option>
              ))}
            </select>
            <input name="note" placeholder="Notă internă (opțional)" maxLength={200} className="w-full rounded-xl border border-black/25 px-3 py-2" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify" defaultChecked className="accent-red" /> Trimite email clientului
            </label>
            <button className="btn btn-primary !min-h-10 !py-2">Salvează</button>
          </form>
          <Rows rows={Object.entries(o.emails).map(([k, v]) => [`Email ${k}`, v ?? ""])} />
        </Card>

        {o.customGift && <GiftCard o={o} />}

        <Card title="Istoric">
          <ol className="space-y-1 text-sm">
            {o.history.map((h, i) => (
              <li key={i}>
                {chisinauTime(h.at)} · {adminLabel(h.status)} · {h.by}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function GiftCard({ o }: { o: Order }) {
  const g = o.customGift!;
  const capOk = !g.needsCoordinatorApproval || g.coordinatorApproved;
  return (
    <Card title="YOUR BOX (GM-09): cadoul">
      <Rows
        rows={[
          ["Cadou cerut", g.idea],
          ["Status", g.status],
          ["Cotație", g.amount != null ? `${g.amount} MDL` : "—"],
        ]}
      />
      {g.needsCoordinatorApproval && (
        <p className="mt-3 rounded-xl bg-yellow-100 p-3 text-sm">
          Peste {RULES.custom.maxGiftValueWithoutApproval} MDL: e nevoie de aprobarea scrisă a coordonatorului
          {g.coordinatorApproved ? " (aprobat)." : "."}
        </p>
      )}
      <form action={quoteGift} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={o.id} />
        <label className="text-sm">
          Cotație (MDL)
          <input name="amount" type="number" min={1} step={1} required defaultValue={g.amount} className="mt-1 block w-32 rounded-xl border border-black/25 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="accent-red" /> Trimite cotația pe email
        </label>
        <button className="btn btn-primary !min-h-10 !py-2">Salvează cotația</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {g.needsCoordinatorApproval && !g.coordinatorApproved && <StepButton id={o.id} step="coordinator" label="Coordonatorul a aprobat în scris" />}
        <StepButton id={o.id} step="paid" label="Plata confirmată" disabled={g.status !== "quoted"} />
        <StepButton id={o.id} step="bought" label="Cadou cumpărat" disabled={g.status !== "paid" || !capOk} />
      </div>
    </Card>
  );
}

function StepButton({ id, step, label, disabled }: { id: string; step: string; label: string; disabled?: boolean }) {
  return (
    <form action={giftStep}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      <button disabled={disabled} className="btn btn-ghost !min-h-10 !py-2 text-sm disabled:opacity-40">
        {label}
      </button>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl p-5 ring-1 ring-black/10">
      <h2 className="mb-3 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-sm">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="whitespace-pre-line break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );
}
