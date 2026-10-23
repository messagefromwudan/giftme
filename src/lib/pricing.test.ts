import { describe, expect, it } from "vitest";
import { quote, QuoteError } from "./pricing";

const now = new Date("2026-11-02T10:00:00+02:00");
const q = (items: [string, number][], extra: Partial<Parameters<typeof quote>[0]> = {}) =>
  quote({ items: items.map(([boxId, quantity]) => ({ boxId, quantity })), zone: "chisinau", now, ...extra });

describe("quote", () => {
  it("single box in Chișinău below threshold pays 60 MDL delivery", () => {
    const r = q([["GM-01", 1]]);
    expect(r.subtotal).toBe(440);
    expect(r.offer).toBeNull();
    expect(r.delivery).toEqual({ fee: 60, reason: "standard_fee" });
    expect(r.total).toBe(500);
  });

  it("DUO: exactly 2 boxes get −10%", () => {
    const r = q([["GM-01", 1], ["GM-02", 1]]);
    expect(r.subtotal).toBe(1020);
    expect(r.offer).toMatchObject({ id: "DUO", discount: 102 });
    expect(r.discountedSubtotal).toBe(918);
    expect(r.delivery.fee).toBe(0); // ≥ 800 after discount
    expect(r.total).toBe(918);
  });

  it("free-delivery threshold is measured after the discount", () => {
    // 2 × 440 = 880, −10% = 792 → below 800, so delivery is charged.
    const r = q([["GM-01", 2]]);
    expect(r.discountedSubtotal).toBe(792);
    expect(r.delivery.fee).toBe(60);
    expect(r.total).toBe(852);
  });

  it("TRIO covers 3–9 boxes, ECHIPĂ from 10", () => {
    expect(q([["GM-03", 3]]).offer?.id).toBe("TRIO");
    expect(q([["GM-03", 9]]).offer?.id).toBe("TRIO");
    const team = q([["GM-03", 10]]);
    expect(team.offer).toMatchObject({ id: "ECHIPA", discount: 1000 });
    expect(team.total).toBe(4000);
  });

  it("offers never stack: the best single offer wins", () => {
    // 3 boxes: TRIO 15% vs PASS-IT-ON 15% → tie keeps TRIO and does not burn the code.
    const tie = q([["GM-01", 3]], { code: { type: "PASS_IT_ON", code: "X" } });
    expect(tie.offer?.id).toBe("TRIO");
    expect(tie.codeApplied).toBe(false);
    // 1 box: PASS-IT-ON 15% (68) beats nothing.
    const one = q([["GM-05", 1]], { code: { type: "PASS_IT_ON", code: "X" } });
    expect(one.offer).toMatchObject({ id: "PASS_IT_ON", discount: 68 });
    expect(one.codeApplied).toBe(true);
    // 2 cheap boxes: DUO 10% of 880 = 88 beats REFERRAL 50.
    const duo = q([["GM-01", 2]], { code: { type: "REFERRAL", code: "X" } });
    expect(duo.offer?.id).toBe("DUO");
    // 1 box: REFERRAL 50 applies.
    expect(q([["GM-01", 1]], { code: { type: "REFERRAL", code: "X" } }).offer).toMatchObject({
      id: "REFERRAL",
      discount: 50,
    });
  });

  it("outside Chișinău: 60 MDL, never free", () => {
    const r = q([["GM-02", 5]], { zone: "moldova" });
    expect(r.discountedSubtotal).toBeGreaterThan(800);
    expect(r.delivery.fee).toBe(60);
  });

  it("GM-09: fee only, delivery included in Chișinău, gift pending, Chișinău only", () => {
    const r = q([["GM-09", 1]]);
    expect(r.subtotal).toBe(360);
    expect(r.delivery).toEqual({ fee: 0, reason: "included_in_custom_box" });
    expect(r.customGiftPending).toBe(true);
    expect(r.lines[0].giftQuotedSeparately).toBe(true);
    expect(() => q([["GM-09", 1]], { zone: "moldova" })).toThrow(QuoteError);
  });

  it("offers expire after 28 May 2027 (Chișinău time)", () => {
    const lastDay = new Date("2027-05-28T23:30:00+03:00");
    const after = new Date("2027-05-29T00:10:00+03:00");
    expect(q([["GM-01", 2]], { now: lastDay }).offer?.id).toBe("DUO");
    expect(q([["GM-01", 2]], { now: after }).offer).toBeNull();
  });

  it("merges duplicate lines and accepts lowercase ids", () => {
    const r = q([["gm-01", 1], ["GM-01", 1]]);
    expect(r.lines).toHaveLength(1);
    expect(r.boxCount).toBe(2);
  });

  it.each([
    [[], "EMPTY_ORDER"],
    [[["GM-99", 1]], "UNKNOWN_BOX"],
    [[["GM-01", 0]], "INVALID_QUANTITY"],
    [[["GM-01", 1.5]], "INVALID_QUANTITY"],
    [[["GM-01", 101]], "TOO_MANY_BOXES"],
  ] as [[string, number][], string][])("rejects %j with %s", (items, code) => {
    try {
      q(items);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(QuoteError);
      expect((e as QuoteError).code).toBe(code);
    }
  });
});
