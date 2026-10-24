import "server-only";
import ExcelJS from "exceljs";
import { STATUS_LABEL, type Order } from "./orders";

// Accounting export. Customer text is untrusted: cells that a spreadsheet would treat as
// formulas (= + - @ tab CR) are prefixed with an apostrophe.

const COLUMNS: { header: string; width: number; get: (o: Order) => string | number }[] = [
  { header: "Nr. comandă", width: 12, get: (o) => o.id },
  { header: "Data comenzii", width: 18, get: (o) => o.createdAt.replace("T", " ").slice(0, 16) },
  { header: "Comandă de exercițiu", width: 10, get: () => "Da" },
  { header: "Sursa", width: 12, get: (o) => o.source },
  { header: "Status", width: 16, get: (o) => STATUS_LABEL[o.status].ro },
  { header: "Client", width: 22, get: (o) => o.buyer.name },
  { header: "Email", width: 26, get: (o) => o.buyer.email },
  { header: "Telefon", width: 14, get: (o) => o.buyer.phone },
  { header: "Destinatar", width: 20, get: (o) => o.recipient.name },
  { header: "Cutii", width: 30, get: (o) => o.quote.lines.map((l) => `${l.quantity}×${l.boxId}`).join("; ") },
  { header: "Nr. cutii", width: 8, get: (o) => o.quote.boxCount },
  { header: "Subtotal (MDL)", width: 12, get: (o) => o.quote.subtotal },
  { header: "Ofertă", width: 14, get: (o) => o.quote.offer?.name ?? "" },
  { header: "Reducere (MDL)", width: 12, get: (o) => o.quote.offer?.discount ?? 0 },
  { header: "Livrare (MDL)", width: 12, get: (o) => o.quote.delivery.fee },
  { header: "Total (MDL)", width: 12, get: (o) => o.quote.total },
  { header: "Plată", width: 14, get: (o) => (o.payment === "cash" ? "numerar la livrare" : "transfer bancar") },
  { header: "Zonă", width: 12, get: (o) => (o.delivery.zone === "chisinau" ? "Chișinău" : "Moldova") },
  { header: "Localitate", width: 14, get: (o) => (o.delivery.zone === "chisinau" ? "Chișinău" : o.delivery.city) },
  { header: "Adresă", width: 30, get: (o) => o.delivery.address },
  { header: "Data livrării", width: 12, get: (o) => o.delivery.date },
  { header: "Cod reducere", width: 16, get: (o) => (o.code?.applied ? o.code.code : "") },
  { header: "Cadou GM-09", width: 24, get: (o) => o.customGift?.idea ?? "" },
  { header: "Cotație cadou (MDL)", width: 12, get: (o) => o.customGift?.amount ?? "" },
  { header: "Status cadou", width: 14, get: (o) => o.customGift?.status ?? "" },
];

export const safeCell = (v: string | number) =>
  typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;

export function ordersCsv(orders: Order[]): string {
  // Semicolons + BOM: opens correctly in Excel with Romanian regional settings.
  const cell = (v: string | number) => {
    const s = String(safeCell(v));
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.map((c) => cell(c.header)).join(";")];
  for (const o of orders) lines.push(COLUMNS.map((c) => cell(c.get(o))).join(";"));
  return "﻿" + lines.join("\r\n");
}

export async function ordersXlsx(orders: Order[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GiftMe!";
  const ws = wb.addWorksheet("Comenzi", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  ws.getRow(1).font = { bold: true };
  for (const o of orders) ws.addRow(COLUMNS.map((c) => safeCell(c.get(o))));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
