import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunOptions, RunResult } from "./llm";

// A scripted stand-in for the model: each test decides what the "model" does.
const script = vi.hoisted(() => ({ run: null as null | ((opts: RunOptions) => Promise<RunResult>) }));
vi.mock("./llm", async (orig) => {
  const real = await orig<typeof import("./llm")>();
  return { ...real, llmConfigured: () => true, runToolAgent: (opts: RunOptions) => script.run!(opts) };
});

import { chatSchema, hartaReply, MAX_USER_MESSAGES, unknownAmounts } from "./harta";
import { LlmUnavailableError } from "./llm";

const answers = { who: "Profesor/ă", occasion: "Mulțumire", personality: "Liniștită", budget: "550" as const };
const ask = () => hartaReply({ lang: "ro", answers, messages: [{ role: "user", content: "Ce îmi recomanzi?" }] });

beforeEach(() => (script.run = null));

describe("Harta emoției safeguards (any provider)", () => {
  it("API failure → catalog fallback, no crash", async () => {
    script.run = async () => {
      throw new LlmUnavailableError("503 overloaded");
    };
    const r = await ask();
    expect(r.fallback).toBe("api_error");
    expect(r.proposal?.items[0].unitPrice).toBeLessThanOrEqual(550);
  });

  it("refusal → polite redirect and a catalog proposal", async () => {
    script.run = async () => ({ texts: [], refused: true, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, calls: 1 } });
    const r = await ask();
    expect(r.fallback).toBe("refusal");
    expect(r.proposal).not.toBeNull();
  });

  it("made-up products are dropped and prices come from the server", async () => {
    script.run = async (opts) => {
      await opts.execute("show_proposal", {
        items: [{ boxId: "GM-07", quantity: 1 }, { boxId: "GM-77", quantity: 1 }],
        reasons: [
          { product: "Agendă personalizată", why: "Își notează totul." },
          { product: "Parfum de lux", why: "invented" },
        ],
        custom_gift: "",
        summary: "Pentru profesoara care a crezut în tine.",
      });
      return { texts: ["Îți propun BOX PROFESOR."], refused: false, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, calls: 1 } };
    };
    const r = await ask();
    expect(r.proposal?.items.map((i) => [i.boxId, i.unitPrice])).toEqual([["GM-07", 530]]);
    expect(r.proposal?.reasons.map((x) => x.product)).toEqual(["Agendă personalizată"]);
  });

  it("a reply stating a price the server did not produce is replaced", async () => {
    script.run = async (opts) => {
      await opts.execute("show_proposal", { items: [{ boxId: "GM-07", quantity: 1 }], reasons: [], custom_gift: "", summary: "x" });
      return { texts: ["BOX PROFESOR costă doar 399 MDL azi!"], refused: false, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, calls: 1 } };
    };
    const r = await ask();
    expect(r.text).not.toContain("399");
    expect(r.proposal?.total).toBe(530);
  });

  it("amounts produced by the quote tool are allowed in the reply", async () => {
    script.run = async (opts) => {
      await opts.execute("get_quote", { items: [{ boxId: "GM-01", quantity: 2 }] });
      return { texts: ["Două cutii F-R-I-E-N-D-S: 880 MDL, cu DUO −88 MDL, adică 792 MDL."], refused: false, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, calls: 1 } };
    };
    expect((await ask()).text).toContain("792 MDL");
  });

  it("the price guard reads Romanian number formats", () => {
    const allowed = new Set([530, 1020]);
    expect(unknownAmounts("530 MDL și 1 020 lei", allowed)).toEqual([]);
    expect(unknownAmounts("doar 499 lei", allowed)).toEqual([499]);
    expect(unknownAmounts("1.050 MDL", allowed)).toEqual([1050]);
  });

  it("a session is limited to 12 customer messages (schema caps history)", () => {
    const msgs = Array.from({ length: 2 * MAX_USER_MESSAGES + 4 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x" }));
    expect(chatSchema.safeParse({ lang: "ro", answers, messages: msgs }).success).toBe(false);
  });
});
