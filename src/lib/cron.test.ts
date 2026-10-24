import { afterEach, describe, expect, it, vi } from "vitest";
import { runDailyCleanup } from "./cron";
import { db, MemoryDb, setDb } from "./db";

afterEach(() => vi.restoreAllMocks());

describe("daily cron", () => {
  it("a failing never-revealed step is logged and does not stop ping, cleanup or the 30-day deletion", async () => {
    setDb(new MemoryDb());
    const ping = vi.spyOn(db(), "ping");
    const cleanup = vi.spyOn(db(), "cleanup");
    const expired = vi.spyOn(db(), "expiredMessages");
    vi.spyOn(db(), "unrevealedMessages").mockRejectedValue(new Error("boom"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await runDailyCleanup(new Date("2027-06-28T08:00:00Z"));

    expect(ping).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(expired).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: false, failed: ["unrevealedMessages"], cleaned: { rateLimits: 0, idempotencyKeys: 0, messages: 0, unrevealedMessages: null } });
    expect(log).toHaveBeenCalledWith("[cron daily] unrevealedMessages failed:", expect.any(Error));
  });

  it("an earlier failure does not stop the later steps either", async () => {
    setDb(new MemoryDb());
    vi.spyOn(db(), "ping").mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const expired = vi.spyOn(db(), "expiredMessages");
    const r = await runDailyCleanup(new Date("2026-10-25T04:00:00Z"));
    expect(expired).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: false, failed: ["ping"], cleaned: { messages: 0, unrevealedMessages: 0 } });
  });

  it("before 27 June 2027 the never-revealed step does not even query the database", async () => {
    setDb(new MemoryDb());
    const unrevealed = vi.spyOn(db(), "unrevealedMessages");
    const r = await runDailyCleanup(new Date("2027-06-26T20:59:59Z"));
    expect(unrevealed).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
});
