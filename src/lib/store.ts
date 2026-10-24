import "server-only";
import { Redis } from "@upstash/redis";

// Minimal key-value interface over Upstash Redis. Locally (and in tests) it falls back to an
// in-memory store, so the site runs without any credentials. Production refuses to use memory.

export interface KV {
  get<T>(key: string): Promise<T | null>;
  /** Returns false when `nx` is set and the key already exists. */
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  /** Newest first. */
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  sadd(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

class RedisKV implements KV {
  constructor(private r: Redis) {}
  get<T>(key: string) {
    return this.r.get<T>(key);
  }
  async set(key: string, value: unknown, opts: { ex?: number; nx?: boolean } = {}) {
    const res =
      opts.ex && opts.nx
        ? await this.r.set(key, value, { ex: opts.ex, nx: true })
        : opts.nx
          ? await this.r.set(key, value, { nx: true })
          : opts.ex
            ? await this.r.set(key, value, { ex: opts.ex })
            : await this.r.set(key, value);
    return res === "OK";
  }
  async del(key: string) {
    await this.r.del(key);
  }
  incr(key: string) {
    return this.r.incr(key);
  }
  async expire(key: string, seconds: number) {
    await this.r.expire(key, seconds);
  }
  async zadd(key: string, score: number, member: string) {
    await this.r.zadd(key, { score, member });
  }
  zrevrange(key: string, start: number, stop: number) {
    return this.r.zrange<string[]>(key, start, stop, { rev: true });
  }
  async sadd(key: string, member: string) {
    await this.r.sadd(key, member);
  }
  smembers(key: string) {
    return this.r.smembers(key);
  }
}

export class MemoryKV implements KV {
  private data = new Map<string, { v: unknown; exp?: number }>();
  private live(key: string) {
    const e = this.data.get(key);
    if (e?.exp && e.exp < Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  async get<T>(key: string) {
    const e = this.live(key);
    return e ? (structuredClone(e.v) as T) : null;
  }
  async set(key: string, value: unknown, opts: { ex?: number; nx?: boolean } = {}) {
    if (opts.nx && this.live(key)) return false;
    this.data.set(key, { v: structuredClone(value), exp: opts.ex ? Date.now() + opts.ex * 1000 : undefined });
    return true;
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async incr(key: string) {
    const e = this.live(key);
    const n = Number(e?.v ?? 0) + 1;
    this.data.set(key, { v: n, exp: e?.exp });
    return n;
  }
  async expire(key: string, seconds: number) {
    const e = this.live(key);
    if (e) e.exp = Date.now() + seconds * 1000;
  }
  async zadd(key: string, score: number, member: string) {
    const z = ((this.live(key)?.v as [string, number][]) ?? []).filter(([m]) => m !== member);
    z.push([member, score]);
    this.data.set(key, { v: z });
  }
  async zrevrange(key: string, start: number, stop: number) {
    const z = ((this.live(key)?.v as [string, number][]) ?? []).slice().sort((a, b) => b[1] - a[1]);
    return z.slice(start, stop === -1 ? undefined : stop + 1).map(([m]) => m);
  }
  async sadd(key: string, member: string) {
    const s = new Set((this.live(key)?.v as string[]) ?? []);
    s.add(member);
    this.data.set(key, { v: [...s] });
  }
  async smembers(key: string) {
    return ((this.live(key)?.v as string[]) ?? []).slice();
  }
}

const g = globalThis as unknown as { __giftmeKV?: KV };

export function storeConfigured(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  );
}

export class StoreUnavailableError extends Error {
  constructor() {
    super("Order storage is not configured");
    this.name = "StoreUnavailableError";
  }
}

export function kv(): KV {
  if (g.__giftmeKV) return g.__giftmeKV;
  if (storeConfigured()) {
    g.__giftmeKV = new RedisKV(Redis.fromEnv());
  } else if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    // Never silently keep orders in memory on Vercel: they would vanish between requests.
    throw new StoreUnavailableError();
  } else {
    g.__giftmeKV = new MemoryKV();
  }
  return g.__giftmeKV;
}

/** Tests inject their own store. */
export function setKV(store: KV) {
  g.__giftmeKV = store;
}
