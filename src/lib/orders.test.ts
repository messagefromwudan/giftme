import { beforeEach, describe, expect, it } from "vitest";
import { MemoryKV, setKV } from "./store";
import { confirmOrder, createOrder, deliveryDateBounds, findOrderForCustomer, OrderError } from "./orders";
import { createPassItOnCode, referralCredits } from "./codes";

const date = deliveryDateBounds().min;

function input(over: Record<string, unknown> = {}) {
  return {
    lang: "ro",
    items: [{ boxId: "GM-01", quantity: 1 }],
    buyer: { name: "Ana Popescu", email: "Ana@Example.com", phone: "068 000 000" },
    recipient: { name: "Ion" },
    personalization: { occasion: "Zi de naștere", engraving: "Pentru Ion", labels: "" },
    delivery: { zone: "chisinau", address: "str. Exemplu 1", date },
    payment: "cash",
    acceptTerms: true,
    ...over,
  };
}

beforeEach(() => setKV(new MemoryKV()));

describe("createOrder", () => {
  it("web order is received immediately, priced on the server, with a referral code", async () => {
    const { order } = await createOrder({ ...input(), total: 1, quote: { total: 1 } }, { source: "web" });
    expect(order.id).toBe("GM-1001");
    expect(order.status).toBe("received");
    expect(order.buyer.email).toBe("ana@example.com");
    expect(order.quote.total).toBe(500); // client-sent totals are ignored
    expect(order.referralCode).toMatch(/^PRIETEN-/);
    expect(order.simulated).toBe(true);
  });

  it("agent orders wait for human approval", async () => {
    const { order } = await createOrder(input(), { source: "agent_api" });
    expect(order.status).toBe("awaiting_approval");
    expect(order.referralCode).toBeUndefined();
    const confirmed = await confirmOrder(order, "email-link");
    expect(confirmed.status).toBe("received");
  });

  it("is idempotent", async () => {
    const a = await createOrder(input(), { source: "web", idempotencyKey: "k1" });
    const b = await createOrder(input(), { source: "web", idempotencyKey: "k1" });
    expect(b.replayed).toBe(true);
    expect(b.order.id).toBe(a.order.id);
  });

  it("REFER A FRIEND: new customer −50, referrer earns a credit used on the next order", async () => {
    const { order: first } = await createOrder(input(), { source: "web" });
    const friend = await createOrder(
      input({ buyer: { name: "Maria", email: "maria@example.com", phone: "069000000" }, code: first.referralCode }),
      { source: "web" },
    );
    expect(friend.order.quote.offer).toMatchObject({ id: "REFERRAL", discount: 50 });
    expect(friend.order.code?.applied).toBe(true);
    expect(await referralCredits("ana@example.com")).toBe(1);

    const next = await createOrder(input(), { source: "web" });
    expect(next.order.quote.offerSource).toBe("credit");
    expect(await referralCredits("ana@example.com")).toBe(0);
  });

  it("rejects own referral code and codes on a second order", async () => {
    const { order: first } = await createOrder(input(), { source: "web" });
    const own = await createOrder(input({ code: first.referralCode }), { source: "web" });
    expect(own.order.code).toMatchObject({ applied: false, rejected: "own_code" });

    const m = { name: "Maria", email: "maria@example.com", phone: "069000000" };
    await createOrder(input({ buyer: m }), { source: "web" });
    const second = await createOrder(input({ buyer: m, code: first.referralCode }), { source: "web" });
    expect(second.order.code).toMatchObject({ applied: false, rejected: "not_first_order" });
  });

  it("PASS-IT-ON codes are single use", async () => {
    const pass = await createPassItOnCode("GM-0");
    const a = await createOrder(input({ code: pass.code }), { source: "web" });
    expect(a.order.quote.offer?.id).toBe("PASS_IT_ON");
    const b = await createOrder(
      input({ buyer: { name: "Bogdan", email: "b@example.com", phone: "069000001" }, code: pass.code }),
      { source: "web" },
    );
    expect(b.order.code).toMatchObject({ applied: false, rejected: "used" });
  });

  it("GM-09 requires the gift idea and the GM-09 terms", async () => {
    const items = [{ boxId: "GM-09", quantity: 1 }];
    await expect(createOrder(input({ items }), { source: "web" })).rejects.toThrow(OrderError);
    const { order } = await createOrder(
      input({ items, customGift: { idea: "o bijuterie" }, acceptCustomTerms: true }),
      { source: "web" },
    );
    expect(order.customGift).toMatchObject({ idea: "o bijuterie", status: "awaiting_quote" });
    expect(order.quote.delivery.fee).toBe(0);
  });

  it("validates dates, terms and untrusted text", async () => {
    await expect(
      createOrder(input({ delivery: { zone: "chisinau", address: "str. Exemplu 1", date: "2020-01-01" } }), { source: "web" }),
    ).rejects.toMatchObject({ code: "INVALID_DATE" });
    await expect(createOrder(input({ acceptTerms: false }), { source: "web" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const { order } = await createOrder(input({ notes: "hi\u0000\u0007 there\nline2" }), { source: "web" });
    expect(order.notes).toBe("hi there\nline2");
  });

  it("tracking needs the token or the buyer's email", async () => {
    const { order } = await createOrder(input(), { source: "web" });
    expect(await findOrderForCustomer(order.id, { email: "ANA@example.com" })).not.toBeNull();
    expect(await findOrderForCustomer(order.id, { token: order.token })).not.toBeNull();
    expect(await findOrderForCustomer(order.id, { email: "x@example.com" })).toBeNull();
    expect(await findOrderForCustomer(order.id, { token: "nope" })).toBeNull();
  });
});
