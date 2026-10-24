import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunOptions, RunResult } from "./llm";

const script = vi.hoisted(() => ({ run: null as null | ((opts: RunOptions) => Promise<RunResult>) }));
vi.mock("./llm", async (orig) => {
  const real = await orig<typeof import("./llm")>();
  return { ...real, llmConfigured: () => true, runToolAgent: (opts: RunOptions) => script.run!(opts) };
});

import { budgetPlan, hartaReply, planText, type Answers } from "./harta";

const usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, calls: 1 };
const a = (who: string, budget: Answers["budget"], occasion = "Mulțumire", personality = "Liniștită"): Answers => ({ who, occasion, personality, budget });

beforeEach(() => (script.run = null));

describe("Harta budget plan (budget = box price; delivery added at checkout)", () => {
  it("teacher, up to 550 → BOX PROFESOR, within budget", () => {
    expect(budgetPlan(a("Profesor/ă", "550"))).toMatchObject({ kind: "box", box: { id: "GM-07" }, overBy: 0 });
  });

  it("teacher, up to 450 → BOX PROFESOR is 80 MDL over (clearly out) and boxes fit: choose within", () => {
    expect(budgetPlan(a("Profesor/ă", "450"))).toEqual({ kind: "choose", limit: 450 });
  });

  it("English answers map to the same boxes", () => {
    expect(budgetPlan(a("A teacher", "550"))).toMatchObject({ kind: "box", box: { id: "GM-07" } });
  });

  it("colleague, up to 450 → BOX CORPORATE, 50 MDL over and said so", () => {
    const p = budgetPlan(a("Coleg sau echipă", "450"));
    expect(p).toMatchObject({ kind: "box", box: { id: "GM-03" }, overBy: 50 });
    if (p.kind === "box") expect(planText(p, "ro")).toContain("cu 50 MDL peste bugetul de 450 MDL");
  });

  it("teacher, up to 400 → no box fits: BOX PROFESOR, 130 MDL over, cheapest box named", () => {
    const p = budgetPlan(a("Profesor/ă", "400" as Answers["budget"])) // only reachable through code; the chips start at 450;
    expect(p).toMatchObject({ kind: "box", box: { id: "GM-07" }, overBy: 130, cheapest: { id: "GM-01" } });
    if (p.kind === "box") {
      const t = planText(p, "ro");
      expect(t).toContain("cu 130 MDL peste bugetul de 400 MDL");
      expect(t).toContain("BOX F-R-I-E-N-D-S, 440 MDL");
      expect(t).toContain("Livrarea se adaugă la comandă");
    }
  });

  it("friend, birthday, up to 450 → BOX F-R-I-E-N-D-S", () => {
    expect(budgetPlan(a("Prieten/ă", "450", "Zi de naștere", "Jucăușă"))).toMatchObject({ kind: "box", box: { id: "GM-01" }, overBy: 0 });
  });

  it("no dedicated box (parent) → the model chooses within the budget", () => {
    expect(budgetPlan(a("Mamă sau tată", "550"))).toEqual({ kind: "choose", limit: 550 });
  });
});

describe("Harta first proposal follows the plan", () => {
  it("a model proposing an unrelated box for a teacher is overruled by BOX PROFESOR", async () => {
    let system = "";
    script.run = async (opts) => {
      system = opts.system;
      await opts.execute("show_proposal", { items: [{ boxId: "GM-01", quantity: 1 }], reasons: [], custom_gift: "", summary: "x" });
      return { texts: ["Îți propun BOX F-R-I-E-N-D-S; cu livrarea totalul e 500 MDL."], refused: false, usage };
    };
    const r = await hartaReply({ lang: "ro", answers: a("Profesor/ă", "550"), messages: [] });
    expect(system).toContain("Propose GM-07 BOX PROFESOR (530 MDL)");
    expect(system).toContain("never add delivery to the budget");
    expect(r.proposal?.items.map((i) => i.boxId)).toEqual(["GM-07"]);
    expect(r.text).toContain("BOX PROFESOR");
    expect(r.text).toContain("Livrarea se adaugă la comandă");
  });

  it("later turns may change the box when the customer asks", async () => {
    script.run = async (opts) => {
      await opts.execute("show_proposal", { items: [{ boxId: "GM-01", quantity: 1 }], reasons: [], custom_gift: "", summary: "x" });
      return { texts: ["Atunci îți propun BOX F-R-I-E-N-D-S."], refused: false, usage };
    };
    const r = await hartaReply({ lang: "ro", answers: a("Profesor/ă", "550"), messages: [{ role: "user", content: "Nu-mi place, altceva" }] });
    expect(r.proposal?.items[0].boxId).toBe("GM-01");
  });
});

describe("Harta privacy filter", () => {
  it("emails and phone numbers in follow-up messages and answers never reach the model", async () => {
    let seen: RunOptions | null = null;
    script.run = async (opts) => {
      seen = opts;
      return { texts: ["Sigur."], refused: false, usage };
    };
    await hartaReply({
      lang: "ro",
      answers: { ...a("Profesor/ă", "550"), personality: "ana@mail.md 069123456" },
      messages: [{ role: "user", content: "E pentru doamna Ion, ion.maria@gmail.com, tel. +373 69 123 456" }],
    });
    const sent = JSON.stringify(seen!.messages) + seen!.system;
    expect(sent).not.toContain("ion.maria@gmail.com");
    expect(sent).not.toContain("69 123 456");
    expect(sent).not.toContain("ana@mail.md");
    expect(sent).toContain("[email ascuns]");
    expect(sent).toContain("[telefon ascuns]");
  });
});

describe("Harta price check and budgets typed in the chat", () => {
  it("a budget sentence may use the customer's figure and the difference; other sentences may not", async () => {
    const { budgetAmounts, budgetAwareUnknownAmounts } = await import("./harta");
    const budget = budgetAmounts([{ role: "user", content: "Am doar 400 lei" }]);
    const allowed = new Set([530, 440]);
    expect(budgetAwareUnknownAmounts("BOX PROFESOR costă 530 MDL, cu 130 MDL peste bugetul tău de 400 MDL.", allowed, budget)).toEqual([]);
    expect(budgetAwareUnknownAmounts("Azi BOX PROFESOR costă doar 400 MDL.", allowed, budget)).toEqual([400]);
  });
});
