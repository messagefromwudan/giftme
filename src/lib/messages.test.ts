import { beforeEach, describe, expect, it } from "vitest";
import { MemoryDb, setDb } from "./db";
import { createOrder, deliveryDateBounds } from "./orders";
import { checkCode } from "./codes";
import {
  deleteExpiredMessages,
  messageForRecipient,
  orderForMessages,
  revealPassCode,
  saveTextMessage,
  startMediaUpload,
} from "./messages";

const order = (source: "web" | "agent_api" = "web") =>
  createOrder(
    {
      lang: "ro",
      items: [{ boxId: "GM-01", quantity: 1 }],
      buyer: { name: "Ana Popescu", email: "ana@example.com", phone: "068000000" },
      recipient: { name: "Ion" },
      personalization: { occasion: "Zi de naștere" },
      delivery: { zone: "chisinau", address: "str. Exemplu 1", date: deliveryDateBounds().min },
      payment: "cash",
      acceptTerms: true,
    },
    { source },
  ).then((r) => r.order);

beforeEach(() => setDb(new MemoryDb()));

describe("QR messages", () => {
  it("only the buyer's tracking token can add a message, and only to a confirmed order", async () => {
    const o = await order();
    await expect(orderForMessages(o.id, "wrong")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const pending = await order("agent_api");
    await expect(orderForMessages(pending.id, pending.token)).rejects.toMatchObject({ code: "NOT_CONFIRMED" });
    expect((await orderForMessages(o.id, o.token)).id).toBe(o.id);
  });

  it("text message: long unguessable id, recipient view, one PASS-IT-ON code, deleted 30 days after reveal", async () => {
    const o = await order();
    const m = await saveTextMessage(o, "La mulți ani, Ion!\u0007");
    expect(m.id.length).toBeGreaterThanOrEqual(32);
    const view = await messageForRecipient(m.id);
    expect(view).toMatchObject({ kind: "text", text: "La mulți ani, Ion!", recipient: "Ion", passCode: null });

    const a = await revealPassCode(m.id);
    const b = await revealPassCode(m.id);
    expect(a.code).toMatch(/^PASS-/);
    expect(b.code).toBe(a.code); // revealing twice gives the same single code
    expect((await checkCode(a.code, "friend@example.com")).ok).toBe(true);

    expect(await deleteExpiredMessages(new Date(Date.now() + 29 * 86_400_000))).toBe(0);
    expect(await deleteExpiredMessages(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
    expect(await messageForRecipient(m.id)).toBeNull();
  });

  it("a new message replaces the old one", async () => {
    const o = await order();
    const first = await saveTextMessage(o, "prima");
    await saveTextMessage(o, "a doua");
    expect(await messageForRecipient(first.id)).toBeNull();
  });

  it("rejects bad ids, non-media files and oversized uploads", async () => {
    expect(await messageForRecipient("short")).toBeNull();
    const o = await order();
    await expect(startMediaUpload(o, "application/pdf", 1000)).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
    await expect(startMediaUpload(o, "video/mp4", 60 * 1024 * 1024)).rejects.toMatchObject({ code: "TOO_LARGE" });
    await expect(saveTextMessage(o, " ")).rejects.toMatchObject({ code: "INVALID_TEXT" });
  });
});
