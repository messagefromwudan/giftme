import type { Locale } from "./catalog";

// Shared by the server (emails, API) and the browser (tracking page).

export type OrderStatus = "awaiting_approval" | "received" | "preparing" | "delivered" | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = ["awaiting_approval", "received", "preparing", "delivered", "cancelled"];

export const STATUS_LABEL: Record<OrderStatus, Record<Locale, string>> = {
  awaiting_approval: { ro: "Așteaptă confirmarea ta", en: "Waiting for your confirmation" },
  received: { ro: "Primită", en: "Received" },
  preparing: { ro: "În pregătire", en: "Being prepared" },
  delivered: { ro: "Livrată", en: "Delivered" },
  cancelled: { ro: "Anulată", en: "Cancelled" },
};
