import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { MemoryDb, SupabaseDb, setDb, type Db } from "./db";
import { confirmOrder, createOrder, deliveryDateBounds, findOrderForCustomer, OrderError } from "./orders";
import { createPassItOnCode, referralCredits } from "./codes";

// Runs against the in-memory store, and also against a real Supabase database when
// TEST_SUPABASE=1 with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set. Test data uses the reserved
// domain test.giftme.invalid and is deleted afterwards.

const TEST_DOMAIN = "test.giftme.invalid";
const run = Date.now().toString(36);
let n = 0;
const email = (name: string) => `${name}.${run}.${++n}@${TEST_DOMAIN}`;

const supabaseClient =
  process.env.TEST_SUPABASE === "1" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const backends: [string, () => Db][] = [["memory", () => new MemoryDb()]];
if (supabaseClient) backends.push(["supabase", () => new SupabaseDb(supabaseClient)]);

afterAll(async () => {
  if (!supabaseClient) return;
  const like = `%@${TEST_DOMAIN}`;
  const { data: orders } = await supabaseClient.from("orders").select("id").like("buyer_email", like);
  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length) {
    await supabaseClient.from("idempotency_keys").delete().in("order_id", ids);
    await supabaseClient.from("discount_codes").delete().in("used_by_order_id", ids);
    await supabaseClient.from("orders").delete().in("id", ids); // cascades to items and referral uses
  }
  await supabaseClient.from("discount_codes").delete().like("owner_email", like);
  await supabaseClient.from("discount_codes").delete().like("source_order_id", `TEST-${run}%`);
  await supabaseClient.from("referral_credits").delete().like("email", like);
});

describe.each(backends)("orders on %s", (_name, makeDb) => {
  const date = deliveryDateBounds().min;
  let ana: string;

  function input(over: Record<string, unknown> = {}) {
    return {
      lang: "ro",
      items: [{ boxId: "GM-01", quantity: 1 }],
      buyer: { name: "Ana Popescu", email: ana, phone: "068 000 000" },
      recipient: { name: "Ion" },
      personalization: { occasion: "Zi de naștere", engraving: "Pentru Ion", labels: "" },
      delivery: { zone: "chisinau", address: "str. Exemplu 1", date },
      payment: "cash",
      acceptTerms: true,
      ...over,
    };
  }
  const buyer = (name: string) => ({ name, email: email(name.toLowerCase()), phone: "069000000" });

  beforeEach(() => {
    setDb(makeDb());
    ana = email("ana");
  });

  it("web order is received immediately, priced on the server, with a referral code", async () => {
    const { order } = await createOrder(
      { ...input({ buyer: { name: "Ana Popescu", email: ana.toUpperCase(), phone: "068 000 000" } }), total: 1, quote: { total: 1 } },
      { source: "web" },
    );
    expect(order.id).toMatch(/^GM-\d{4,}$/);
    expect(order.status).toBe("received");
    expect(order.buyer.email).toBe(ana);
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
    const key = `test-${run}-${++n}`;
    const a = await createOrder(input(), { source: "web", idempotencyKey: key });
    const b = await createOrder(input(), { source: "web", idempotencyKey: key });
    expect(b.replayed).toBe(true);
    expect(b.order.id).toBe(a.order.id);
  });

  it("REFER A FRIEND: new customer −50, referrer earns a credit used on the next order", async () => {
    const { order: first } = await createOrder(input(), { source: "web" });
    const friend = await createOrder(input({ buyer: buyer("Maria"), code: first.referralCode }), { source: "web" });
    expect(friend.order.quote.offer).toMatchObject({ id: "REFERRAL", discount: 50 });
    expect(friend.order.code?.applied).toBe(true);
    expect(await referralCredits(ana)).toBe(1);

    const next = await createOrder(input(), { source: "web" });
    expect(next.order.quote.offerSource).toBe("credit");
    expect(await referralCredits(ana)).toBe(0);
  });

  it("rejects own referral code and codes on a second order", async () => {
    const { order: first } = await createOrder(input(), { source: "web" });
    const own = await createOrder(input({ code: first.referralCode }), { source: "web" });
    expect(own.order.code).toMatchObject({ applied: false, rejected: "own_code" });

    const m = buyer("Maria");
    await createOrder(input({ buyer: m }), { source: "web" });
    const second = await createOrder(input({ buyer: m, code: first.referralCode }), { source: "web" });
    expect(second.order.code).toMatchObject({ applied: false, rejected: "not_first_order" });
  });

  it("PASS-IT-ON codes are single use", async () => {
    const pass = await createPassItOnCode(`TEST-${run}-${++n}`);
    const a = await createOrder(input({ code: pass.code }), { source: "web" });
    expect(a.order.quote.offer?.id).toBe("PASS_IT_ON");
    const b = await createOrder(input({ buyer: buyer("Bogdan"), code: pass.code }), { source: "web" });
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
    expect(await findOrderForCustomer(order.id, { email: ana.toUpperCase() })).not.toBeNull();
    expect(await findOrderForCustomer(order.id, { token: order.token })).not.toBeNull();
    expect(await findOrderForCustomer(order.id, { email: `x@${TEST_DOMAIN}` })).toBeNull();
    expect(await findOrderForCustomer(order.id, { token: "nope" })).toBeNull();
  });
});
