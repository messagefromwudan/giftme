import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CodeRecord } from "./codes";
import type { Order } from "./orders";
import type { Message } from "./messages";

// The ONLY module that talks to storage. Production: Supabase Postgres + private Storage,
// accessed with the service-role key from the server only (see supabase/migrations).
// Locally and in unit tests: an in-memory implementation with the same behaviour.

export type InsertCodeResult = "ok" | "code_taken" | "owner_has_code";

export interface Db {
  nextOrderId(): Promise<string>;
  insertOrder(order: Order): Promise<void>;
  saveOrder(order: Order): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  /** Newest first. */
  listOrders(limit: number): Promise<Order[]>;
  orderIdsByEmail(email: string): Promise<string[]>;

  /** Order id stored for this key within the last 24 h, if any. */
  idempotentOrderId(key: string): Promise<string | null>;
  /** Stores key → orderId unless the key exists; returns the order id that owns the key. */
  claimIdempotencyKey(key: string, orderId: string): Promise<string>;

  getCode(code: string): Promise<CodeRecord | null>;
  insertCode(rec: CodeRecord): Promise<InsertCodeResult>;
  referralCodeOf(email: string): Promise<string | null>;
  passCodeUsed(code: string): Promise<boolean>;
  /** Atomic single use; false if already used or expired. */
  claimPassCode(code: string, orderId: string): Promise<boolean>;
  addReferralUse(code: string, orderId: string): Promise<void>;
  addCredit(email: string): Promise<void>;
  /** Atomic; false when there was no credit to spend. */
  spendCredit(email: string): Promise<boolean>;
  credits(email: string): Promise<number>;

  /** Fixed-window counter; returns the hit count in the current window. */
  rateHit(key: string, windowSec: number): Promise<number>;

  insertMessage(m: Message): Promise<void>;
  saveMessage(m: Message): Promise<void>;
  getMessage(id: string): Promise<Message | null>;
  /** Newest first. */
  messagesForOrder(orderId: string): Promise<Message[]>;
  deleteMessage(id: string): Promise<void>;
  /** Messages whose retention ended (30 days after the PASS-IT-ON reveal). */
  expiredMessages(now: Date): Promise<Message[]>;

  /** Cheap query that counts as activity (keeps a free Supabase project from pausing). */
  ping(): Promise<void>;
  /** Deletes expired rate-limit windows and idempotency keys older than 24 h. */
  cleanup(): Promise<{ rateLimits: number; idempotencyKeys: number }>;

  /** Private bucket for audio/video messages. */
  media: {
    uploadUrl(path: string): Promise<{ signedUrl: string; token: string; path: string }>;
    signedUrl(path: string, expiresInSec: number): Promise<string>;
    remove(paths: string[]): Promise<void>;
  };
}

export class StoreUnavailableError extends Error {
  constructor() {
    super("Storage is not configured");
    this.name = "StoreUnavailableError";
  }
}

const DAY_MS = 86_400_000;
export const MEDIA_BUCKET = "messages";

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

type OrderRow = {
  id: string;
  token: string;
  created_at: string;
  updated_at: string;
  lang: string;
  source: string;
  status: string;
  buyer_email: string;
  total_mdl: number;
  simulated: boolean;
  data: Order;
};

const orderRow = (o: Order): OrderRow => ({
  id: o.id,
  token: o.token,
  created_at: o.createdAt,
  updated_at: o.updatedAt,
  lang: o.lang,
  source: o.source,
  status: o.status,
  buyer_email: o.buyer.email,
  total_mdl: o.quote.total,
  simulated: true,
  data: o,
});

const itemRows = (o: Order) =>
  o.quote.lines.map((l) => ({
    order_id: o.id,
    box_id: l.boxId,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    line_total: l.lineTotal,
  }));

type CodeRow = {
  code: string;
  type: CodeRecord["type"];
  created_at: string;
  owner_email: string | null;
  expires_at: string | null;
  source_order_id: string | null;
  used_by_order_id: string | null;
};

const fromCodeRow = (r: CodeRow): CodeRecord => ({
  code: r.code,
  type: r.type,
  createdAt: r.created_at,
  ...(r.owner_email ? { ownerEmail: r.owner_email } : {}),
  ...(r.expires_at ? { expiresAt: r.expires_at } : {}),
  ...(r.source_order_id ? { sourceOrderId: r.source_order_id } : {}),
});

type MessageRow = {
  id: string;
  order_id: string;
  kind: Message["kind"];
  body: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  revealed_at: string | null;
  pass_code: string | null;
  delete_after: string | null;
};

const messageRow = (m: Message): MessageRow => ({
  id: m.id,
  order_id: m.orderId,
  kind: m.kind,
  body: m.body ?? null,
  storage_path: m.storagePath ?? null,
  mime_type: m.mimeType ?? null,
  size_bytes: m.sizeBytes ?? null,
  created_at: m.createdAt,
  revealed_at: m.revealedAt ?? null,
  pass_code: m.passCode ?? null,
  delete_after: m.deleteAfter ?? null,
});

const fromMessageRow = (r: MessageRow): Message => ({
  id: r.id,
  orderId: r.order_id,
  kind: r.kind,
  ...(r.body != null ? { body: r.body } : {}),
  ...(r.storage_path ? { storagePath: r.storage_path } : {}),
  ...(r.mime_type ? { mimeType: r.mime_type } : {}),
  ...(r.size_bytes != null ? { sizeBytes: r.size_bytes } : {}),
  createdAt: r.created_at,
  ...(r.revealed_at ? { revealedAt: r.revealed_at } : {}),
  ...(r.pass_code ? { passCode: r.pass_code } : {}),
  ...(r.delete_after ? { deleteAfter: r.delete_after } : {}),
});

class DbError extends Error {
  constructor(op: string, err: { message: string; code?: string }) {
    super(`${op}: ${err.message}`);
    this.name = "DbError";
  }
}

function check<T>(op: string, res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new DbError(op, res.error);
  return res.data;
}

export class SupabaseDb implements Db {
  constructor(private sb: SupabaseClient) {}

  async nextOrderId() {
    return check("next_order_id", await this.sb.rpc("giftme_next_order_id")) as string;
  }

  async insertOrder(o: Order) {
    check("insert order", await this.sb.from("orders").insert(orderRow(o)));
    const items = await this.sb.from("order_items").insert(itemRows(o));
    if (items.error) {
      await this.sb.from("orders").delete().eq("id", o.id);
      throw new DbError("insert order_items", items.error);
    }
  }

  async saveOrder(o: Order) {
    const { id, ...row } = orderRow(o);
    check("save order", await this.sb.from("orders").update(row).eq("id", id));
    check("save order_items", await this.sb.from("order_items").upsert(itemRows(o)));
  }

  async getOrder(id: string) {
    const data = check("get order", await this.sb.from("orders").select("data").eq("id", id).maybeSingle());
    return (data?.data as Order | undefined) ?? null;
  }

  async listOrders(limit: number) {
    const data = check(
      "list orders",
      await this.sb.from("orders").select("data").order("created_at", { ascending: false }).limit(limit),
    );
    return (data ?? []).map((r) => r.data as Order);
  }

  async orderIdsByEmail(email: string) {
    const data = check("orders by email", await this.sb.from("orders").select("id").eq("buyer_email", email));
    return (data ?? []).map((r) => r.id as string);
  }

  async idempotentOrderId(key: string) {
    const data = check(
      "get idempotency key",
      await this.sb
        .from("idempotency_keys")
        .select("order_id")
        .eq("key", key)
        .gt("created_at", new Date(Date.now() - DAY_MS).toISOString())
        .maybeSingle(),
    );
    return (data?.order_id as string | undefined) ?? null;
  }

  async claimIdempotencyKey(key: string, orderId: string) {
    // Expired keys may be reused: clear this key if it is older than 24 h, then try to claim it.
    await this.sb.from("idempotency_keys").delete().eq("key", key).lt("created_at", new Date(Date.now() - DAY_MS).toISOString());
    const ins = await this.sb.from("idempotency_keys").insert({ key, order_id: orderId });
    if (!ins.error) return orderId;
    if (ins.error.code !== "23505") throw new DbError("claim idempotency key", ins.error);
    return (await this.idempotentOrderId(key)) ?? orderId;
  }

  async getCode(code: string) {
    const data = check("get code", await this.sb.from("discount_codes").select("*").eq("code", code).maybeSingle());
    return data ? fromCodeRow(data as CodeRow) : null;
  }

  async insertCode(rec: CodeRecord): Promise<InsertCodeResult> {
    const res = await this.sb.from("discount_codes").insert({
      code: rec.code,
      type: rec.type,
      created_at: rec.createdAt,
      owner_email: rec.ownerEmail ?? null,
      expires_at: rec.expiresAt ?? null,
      source_order_id: rec.sourceOrderId ?? null,
    });
    if (!res.error) return "ok";
    if (res.error.code !== "23505") throw new DbError("insert code", res.error);
    return /one_referral_per_owner/.test(`${res.error.message} ${(res.error as { details?: string }).details ?? ""}`)
      ? "owner_has_code"
      : "code_taken";
  }

  async referralCodeOf(email: string) {
    const data = check(
      "referral code of",
      await this.sb.from("discount_codes").select("code").eq("type", "REFERRAL").eq("owner_email", email).maybeSingle(),
    );
    return (data?.code as string | undefined) ?? null;
  }

  async passCodeUsed(code: string) {
    const data = check(
      "pass code used",
      await this.sb.from("discount_codes").select("used_by_order_id").eq("code", code).maybeSingle(),
    );
    return Boolean(data?.used_by_order_id);
  }

  async claimPassCode(code: string, orderId: string) {
    return check("claim pass code", await this.sb.rpc("giftme_claim_pass_code", { p_code: code, p_order_id: orderId })) as boolean;
  }

  async addReferralUse(code: string, orderId: string) {
    check("referral use", await this.sb.from("referral_uses").upsert({ code, order_id: orderId }));
  }

  async addCredit(email: string) {
    check("add credit", await this.sb.rpc("giftme_add_credit", { p_email: email }));
  }

  async spendCredit(email: string) {
    return check("spend credit", await this.sb.rpc("giftme_spend_credit", { p_email: email })) as boolean;
  }

  async credits(email: string) {
    const data = check("credits", await this.sb.from("referral_credits").select("credits").eq("email", email).maybeSingle());
    return (data?.credits as number | undefined) ?? 0;
  }

  async rateHit(key: string, windowSec: number) {
    return check("rate hit", await this.sb.rpc("giftme_rate_hit", { p_key: key, p_window_seconds: windowSec })) as number;
  }

  async insertMessage(m: Message) {
    check("insert message", await this.sb.from("messages").insert(messageRow(m)));
  }

  async saveMessage(m: Message) {
    const { id, ...row } = messageRow(m);
    check("save message", await this.sb.from("messages").update(row).eq("id", id));
  }

  async getMessage(id: string) {
    const data = check("get message", await this.sb.from("messages").select("*").eq("id", id).maybeSingle());
    return data ? fromMessageRow(data as MessageRow) : null;
  }

  async messagesForOrder(orderId: string) {
    const data = check(
      "messages for order",
      await this.sb.from("messages").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    );
    return (data ?? []).map((r) => fromMessageRow(r as MessageRow));
  }

  async deleteMessage(id: string) {
    check("delete message", await this.sb.from("messages").delete().eq("id", id));
  }

  async expiredMessages(now: Date) {
    const data = check(
      "expired messages",
      await this.sb.from("messages").select("*").lt("delete_after", now.toISOString()).limit(200),
    );
    return (data ?? []).map((r) => fromMessageRow(r as MessageRow));
  }

  async ping() {
    check("ping", await this.sb.from("orders").select("id", { head: true, count: "exact" }).limit(1));
  }

  async cleanup() {
    const now = new Date().toISOString();
    const rl = check(
      "cleanup rate limits",
      await this.sb.from("rate_limits").delete({ count: "exact" }).lt("expires_at", now).select("key"),
    );
    const ik = check(
      "cleanup idempotency keys",
      await this.sb
        .from("idempotency_keys")
        .delete({ count: "exact" })
        .lt("created_at", new Date(Date.now() - DAY_MS).toISOString())
        .select("key"),
    );
    return { rateLimits: rl?.length ?? 0, idempotencyKeys: ik?.length ?? 0 };
  }

  media = {
    uploadUrl: async (path: string) =>
      check("media upload url", await this.sb.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path))!,
    signedUrl: async (path: string, expiresInSec: number) =>
      check("media signed url", await this.sb.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresInSec))!.signedUrl,
    remove: async (paths: string[]) => {
      if (paths.length) check("media remove", await this.sb.storage.from(MEDIA_BUCKET).remove(paths));
    },
  };
}

// ---------------------------------------------------------------------------
// In memory (local development and unit tests)
// ---------------------------------------------------------------------------

export class MemoryDb implements Db {
  private orders = new Map<string, Order>();
  private seq = 1000;
  private idem = new Map<string, { orderId: string; at: number }>();
  private codes = new Map<string, CodeRecord & { usedBy?: string }>();
  private uses = new Set<string>();
  private creditMap = new Map<string, number>();
  private rate = new Map<string, { hits: number; exp: number }>();

  async nextOrderId() {
    return `GM-${++this.seq}`;
  }
  async insertOrder(o: Order) {
    if (this.orders.has(o.id)) throw new Error("duplicate order id");
    this.orders.set(o.id, structuredClone(o));
  }
  async saveOrder(o: Order) {
    this.orders.set(o.id, structuredClone(o));
  }
  async getOrder(id: string) {
    const o = this.orders.get(id);
    return o ? structuredClone(o) : null;
  }
  async listOrders(limit: number) {
    return [...this.orders.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, limit)
      .map((o) => structuredClone(o));
  }
  async orderIdsByEmail(email: string) {
    return [...this.orders.values()].filter((o) => o.buyer.email === email).map((o) => o.id);
  }
  async idempotentOrderId(key: string) {
    const e = this.idem.get(key);
    return e && Date.now() - e.at < DAY_MS ? e.orderId : null;
  }
  async claimIdempotencyKey(key: string, orderId: string) {
    const existing = await this.idempotentOrderId(key);
    if (existing) return existing;
    this.idem.set(key, { orderId, at: Date.now() });
    return orderId;
  }
  async getCode(code: string) {
    const c = this.codes.get(code);
    if (!c) return null;
    const { usedBy: _usedBy, ...rec } = c;
    void _usedBy;
    return structuredClone(rec);
  }
  async insertCode(rec: CodeRecord): Promise<InsertCodeResult> {
    if (this.codes.has(rec.code)) return "code_taken";
    if (rec.type === "REFERRAL" && (await this.referralCodeOf(rec.ownerEmail!))) return "owner_has_code";
    this.codes.set(rec.code, structuredClone(rec));
    return "ok";
  }
  async referralCodeOf(email: string) {
    return [...this.codes.values()].find((c) => c.type === "REFERRAL" && c.ownerEmail === email)?.code ?? null;
  }
  async passCodeUsed(code: string) {
    return Boolean(this.codes.get(code)?.usedBy);
  }
  async claimPassCode(code: string, orderId: string) {
    const c = this.codes.get(code);
    if (!c || c.type !== "PASS_IT_ON" || c.usedBy) return false;
    if (c.expiresAt && new Date(c.expiresAt) <= new Date()) return false;
    c.usedBy = orderId;
    return true;
  }
  async addReferralUse(code: string, orderId: string) {
    this.uses.add(`${code}|${orderId}`);
  }
  async addCredit(email: string) {
    this.creditMap.set(email, (this.creditMap.get(email) ?? 0) + 1);
  }
  async spendCredit(email: string) {
    const n = this.creditMap.get(email) ?? 0;
    if (n <= 0) return false;
    this.creditMap.set(email, n - 1);
    return true;
  }
  async credits(email: string) {
    return this.creditMap.get(email) ?? 0;
  }
  async rateHit(key: string, windowSec: number) {
    const now = Date.now();
    const e = this.rate.get(key);
    if (!e || e.exp < now) {
      this.rate.set(key, { hits: 1, exp: now + windowSec * 1000 });
      return 1;
    }
    return ++e.hits;
  }
  private messages = new Map<string, Message>();
  async insertMessage(m: Message) {
    this.messages.set(m.id, structuredClone(m));
  }
  async saveMessage(m: Message) {
    this.messages.set(m.id, structuredClone(m));
  }
  async getMessage(id: string) {
    const m = this.messages.get(id);
    return m ? structuredClone(m) : null;
  }
  async messagesForOrder(orderId: string) {
    return [...this.messages.values()]
      .filter((m) => m.orderId === orderId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => structuredClone(m));
  }
  async deleteMessage(id: string) {
    this.messages.delete(id);
  }
  async expiredMessages(now: Date) {
    return [...this.messages.values()].filter((m) => m.deleteAfter && new Date(m.deleteAfter) < now).map((m) => structuredClone(m));
  }
  async ping() {}
  async cleanup() {
    const now = Date.now();
    let rateLimits = 0;
    let idempotencyKeys = 0;
    for (const [k, v] of this.rate) if (v.exp < now && this.rate.delete(k)) rateLimits++;
    for (const [k, v] of this.idem) if (now - v.at >= DAY_MS && this.idem.delete(k)) idempotencyKeys++;
    return { rateLimits, idempotencyKeys };
  }
  media = {
    uploadUrl: async (): Promise<{ signedUrl: string; token: string; path: string }> => {
      throw new StoreUnavailableError();
    },
    signedUrl: async (): Promise<string> => {
      throw new StoreUnavailableError();
    },
    remove: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __giftmeDb?: Db };

const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export function dbConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && serviceKey());
}

export function db(): Db {
  if (g.__giftmeDb) return g.__giftmeDb;
  if (dbConfigured()) {
    g.__giftmeDb = new SupabaseDb(
      createClient(process.env.SUPABASE_URL!, serviceKey()!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    );
  } else if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    // Never keep orders in memory on Vercel: they would vanish between requests.
    throw new StoreUnavailableError();
  } else {
    g.__giftmeDb = new MemoryDb();
  }
  return g.__giftmeDb;
}

/** Tests inject their own implementation. */
export function setDb(impl: Db | undefined) {
  g.__giftmeDb = impl;
}
