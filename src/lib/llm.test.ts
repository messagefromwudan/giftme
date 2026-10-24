import { afterEach, describe, expect, it, vi } from "vitest";
import { llmInfo, OPENAI_DEFAULT_MODEL, openaiSupportsReasoning } from "./llm";

afterEach(() => vi.unstubAllEnvs());

describe("model per feature", () => {
  it("OPENAI_MODEL_CHAT applies to the chat widget only, defaulting to OPENAI_MODEL", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("OPENAI_MODEL", "gpt-6.1-sol");
    vi.stubEnv("OPENAI_MODEL_CHAT", "");
    expect(llmInfo("chat").model).toBe("gpt-6.1-sol");
    vi.stubEnv("OPENAI_MODEL_CHAT", "small-model");
    expect(llmInfo("chat").model).toBe("small-model");
    expect(llmInfo().model).toBe("gpt-6.1-sol");
    vi.stubEnv("OPENAI_MODEL", "");
    expect(llmInfo().model).toBe(OPENAI_DEFAULT_MODEL);
  });

  it("reasoning settings are not sent to models that reject them", () => {
    expect(openaiSupportsReasoning("gpt-4o-mini")).toBe(false);
    expect(openaiSupportsReasoning("gpt-4.1-nano")).toBe(false);
    expect(openaiSupportsReasoning("gpt-6.1-sol")).toBe(true);
  });
});
