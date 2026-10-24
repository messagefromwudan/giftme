"use client";

import { useSyncExternalStore } from "react";

// The cart lives in the browser (box IDs and quantities only). Prices always come from /api/quote.

export type CartItem = { boxId: string; quantity: number };

const KEY = "giftme-cart-v1";
const EVENT = "giftme-cart";
const EMPTY: CartItem[] = [];

let cached: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };

function read(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cached.raw) return cached.items;
  let items: CartItem[] = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      items = parsed
        .filter((i) => typeof i?.boxId === "string" && Number.isInteger(i?.quantity) && i.quantity > 0)
        .map((i) => ({ boxId: i.boxId, quantity: Math.min(i.quantity, 100) }));
    }
  } catch {
    items = EMPTY;
  }
  cached = { raw, items };
  return items;
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.filter((i) => i.quantity > 0)));
  } catch {
    // Private mode or storage blocked: the cart just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    add(boxId: string, qty = 1) {
      const cur = read();
      const found = cur.find((i) => i.boxId === boxId);
      write(found ? cur.map((i) => (i.boxId === boxId ? { ...i, quantity: i.quantity + qty } : i)) : [...cur, { boxId, quantity: qty }]);
    },
    setQty(boxId: string, quantity: number) {
      write(read().map((i) => (i.boxId === boxId ? { ...i, quantity: Math.max(0, Math.min(100, quantity)) } : i)));
    },
    remove(boxId: string) {
      write(read().filter((i) => i.boxId !== boxId));
    },
    clear() {
      write([]);
    },
  };
}
