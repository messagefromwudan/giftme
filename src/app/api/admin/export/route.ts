import { connection } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listOrders } from "@/lib/orders";
import { ordersCsv, ordersXlsx } from "@/lib/export";
import { errorResponse, json } from "@/lib/http";

export async function GET(req: Request) {
  // Outside try/catch: these signal Next.js that the route is dynamic.
  await connection();
  if (!(await isAdmin())) return json({ error: "UNAUTHORIZED" }, 401);
  try {
    const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    const orders = await listOrders(5000);
    const stamp = new Date().toISOString().slice(0, 10);
    const headers = { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="giftme-comenzi-${stamp}.${format}"` };
    if (format === "xlsx") {
      return new Response(new Uint8Array(await ordersXlsx(orders)), {
        headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
    }
    return new Response(ordersCsv(orders), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  } catch (e) {
    return errorResponse(e);
  }
}
