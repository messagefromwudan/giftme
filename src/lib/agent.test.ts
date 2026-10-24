import { describe, expect, it } from "vitest";
import { agentQuote, boxForAgent, buildCustomBox, catalogDocument } from "./agent";
import { llmsFullTxt, llmsTxt, openApiDocument } from "./agent-docs";
import { getBox } from "./catalog";

describe("published rules agree with the pricing engine", () => {
  it("catalog.json: free delivery strictly over 800 MDL, lead time per box (GM-09: 5, others: 2)", () => {
    const doc = catalogDocument();
    expect(doc.delivery.chisinau).toMatchObject({ fee_mdl: 60, free_over_mdl_after_discount: 800 });
    expect(doc.delivery.chisinau).not.toHaveProperty("free_from_mdl_after_discount");
    for (const b of doc.boxes) expect(b.min_lead_time_days).toBe(b.id === "GM-09" ? 5 : 2);
  });

  it("llms.txt and llms-full.txt say 'over 800' and give GM-09 its 5 days", () => {
    const short = llmsTxt();
    const full = llmsFullTxt();
    expect(short).toMatch(/GM-09 [^\n]*at least 5 days/);
    expect(short).toMatch(/GM-01 [^\n]*at least 2 days/);
    expect(full).toContain("over 800 MDL");
    expect(full).toContain("exactly 800 MDL pays 60 MDL");
    expect(full).toContain("Minimum lead time: 5 days");
    expect(full).not.toMatch(/free from 800/);
  });

  it("openapi, MCP box data and the agent quote carry the same rules", async () => {
    expect(JSON.stringify(openApiDocument())).toContain("over 800 MDL");
    expect(boxForAgent(getBox("GM-09")!).min_lead_time_days).toBe(5);
    expect(buildCustomBox({ gift_idea: "o bijuterie" }).rules.join(" ")).toContain("at least 5 days");
    const r = await agentQuote({ items: [{ boxId: "GM-09", quantity: 1 }] });
    expect(r.delivery_dates.minLeadDays).toBe(5);
  });
});
