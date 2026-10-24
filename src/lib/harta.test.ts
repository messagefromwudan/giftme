import { describe, expect, it } from "vitest";
import { buildProposal, fallbackProposal, hartaReply } from "./harta";

describe("Harta emoției", () => {
  it("proposals use server prices, real boxes only, and drop reasons about invented products", () => {
    const p = buildProposal(
      {
        items: [{ boxId: "gm-07", quantity: 1 }, { boxId: "GM-42", quantity: 1 }],
        reasons: [
          { product: "Suculentă în ghiveci", why: "Îi place să aibă grijă de plante." },
          { product: "Telefon nou", why: "invented" },
        ],
        custom_gift: "",
        summary: "Pentru profesoara care a crezut în tine.",
      },
      "ro",
    );
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.items).toEqual([expect.objectContaining({ boxId: "GM-07", unitPrice: 530 })]);
    expect(p.reasons.map((r) => r.product)).toEqual(["Suculentă în ghiveci"]);
    expect(p.total).toBe(530); // box price; delivery is added at checkout
  });

  it("rejects proposals with no real box", () => {
    expect(buildProposal({ items: [{ boxId: "X", quantity: 1 }], reasons: [], custom_gift: "", summary: "" }, "en")).toHaveProperty("error");
  });

  it("falls back to a catalog suggestion within budget when there is no API key", async () => {
    const r = await hartaReply({ lang: "ro", answers: { who: "profesor", occasion: "mulțumire", personality: "liniștit", budget: "550" }, messages: [] });
    expect(r.fallback).toBe("no_key");
    expect(r.proposal?.items[0].unitPrice).toBeLessThanOrEqual(550);
    expect(fallbackProposal({ who: "x", occasion: "y", personality: "z", budget: "own" }, "en").items[0].boxId).toBe("GM-09");
  });
});
