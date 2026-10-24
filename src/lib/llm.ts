import "server-only";
import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import Anthropic from "@anthropic-ai/sdk";

// The ONLY module that talks to a language model. Harta emoției and /agent-demo describe
// their tools here in a provider-neutral way; the provider is chosen by LLM_PROVIDER
// (default "openai"). Swapping models or providers never touches the safeguards, which live
// in the callers' tool executors (catalog, server-side quotes, proposal validation).

export type LlmTool = {
  name: string;
  description: string;
  /** JSON Schema in strict form: every property required, additionalProperties false. */
  parameters: Record<string, unknown>;
};
export type LlmMessage = { role: "user" | "assistant"; content: string };
export type ToolExecutor = (name: string, args: unknown) => Promise<{ result: unknown; isError?: boolean }>;

export type RunOptions = {
  system: string;
  messages: LlmMessage[];
  tools: LlmTool[];
  execute: ToolExecutor;
  maxRounds: number;
  maxOutputTokens: number;
  effort: "low" | "medium";
  /** Called with each piece of text as soon as a model turn finishes (live demo log). */
  onText?: (text: string) => void;
  timeoutMs?: number;
  /** Label for the usage log line. */
  tag?: string;
  /** Which feature is calling: "chat" (the widget's free questions) may use its own model. */
  feature?: LlmFeature;
  /** Exact model for this run (model comparison on previews); overrides the env settings. */
  model?: string;
};

export type LlmFeature = "default" | "chat";

export type Usage = { inputTokens: number; cachedInputTokens: number; outputTokens: number; calls: number };
export type RunResult = { texts: string[]; refused: boolean; usage: Usage; model?: string };

const emptyUsage = (): Usage => ({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, calls: 0 });

/** Token counts only (never content), for cost tracking in the Vercel logs. */
function logUsage(tag: string | undefined, usage: Usage, model: string) {
  const { provider } = llmInfo();
  console.info(`[llm-usage] ${tag ?? "run"} ${provider}/${model} calls=${usage.calls} in=${usage.inputTokens} cached=${usage.cachedInputTokens} out=${usage.outputTokens}`);
}

/** API unreachable, quota/rate limit, bad key, timeout…: callers switch to their fallback. */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

type Provider = "openai" | "anthropic";
const provider = (): Provider => (process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "openai");

export const OPENAI_DEFAULT_MODEL = "gpt-6-astra";
const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";

/** OPENAI_MODEL for everything; OPENAI_MODEL_CHAT, when set, only for the chat widget's free questions. */
export function llmInfo(feature: LlmFeature = "default") {
  const openaiModel = (feature === "chat" && process.env.OPENAI_MODEL_CHAT) || process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  return provider() === "anthropic"
    ? { provider: "anthropic" as const, processor: "Anthropic", model: process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL }
    : { provider: "openai" as const, processor: "OpenAI", model: openaiModel };
}

/** The gpt-4 and gpt-3.5 families have no reasoning settings and reject them. */
export const openaiSupportsReasoning = (model: string) => !/^gpt-(4|3\.5)/.test(model);

/** Model ids the configured OpenAI key can use (model comparison on previews only). */
export async function listOpenAIModels(): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) throw new LlmUnavailableError("No API key configured");
  const client = new OpenAI({ maxRetries: 1, timeout: 15_000 });
  const ids: string[] = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids.sort();
}

export function llmConfigured(): boolean {
  return provider() === "anthropic" ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(process.env.OPENAI_API_KEY);
}

export async function runToolAgent(opts: RunOptions): Promise<RunResult> {
  if (!llmConfigured()) throw new LlmUnavailableError("No API key configured");
  const model = opts.model ?? llmInfo(opts.feature).model;
  const result = await (provider() === "anthropic" ? runAnthropic(opts) : runOpenAI(opts, model));
  logUsage(opts.tag, result.usage, model);
  return { ...result, model };
}

async function execSafely(execute: ToolExecutor, name: string, rawArgs: string | unknown) {
  let args: unknown;
  try {
    args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
  } catch {
    return { result: { error: "Arguments were not valid JSON" }, isError: true };
  }
  try {
    return await execute(name, args);
  } catch (e) {
    return { result: { error: (e as Error).message.slice(0, 200) }, isError: true };
  }
}

// ---------------------------------------------------------------------------
// OpenAI (Responses API)
// ---------------------------------------------------------------------------

async function runOpenAI(opts: RunOptions, model: string): Promise<RunResult> {
  const client = new OpenAI({ maxRetries: 1, timeout: opts.timeoutMs ?? 45_000 });
  const reasoning = openaiSupportsReasoning(model);
  const tools: OpenAI.Responses.FunctionTool[] = opts.tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    strict: true,
  }));
  const input: OpenAI.Responses.ResponseInputItem[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const texts: string[] = [];
  const usage = emptyUsage();

  for (let round = 0; round <= opts.maxRounds; round++) {
    let res: OpenAI.Responses.Response;
    try {
      res = await client.responses.create({
        model,
        instructions: opts.system,
        input,
        tools,
        ...(reasoning ? { reasoning: { effort: opts.effort } } : {}),
        max_output_tokens: opts.maxOutputTokens,
        // Conversations are not kept by OpenAI for later retrieval; reasoning is passed back encrypted.
        store: false,
        ...(reasoning ? { include: ["reasoning.encrypted_content" as const] } : {}),
      });
    } catch (e) {
      throw new LlmUnavailableError(e instanceof OpenAI.APIError ? `${e.status ?? ""} ${e.message}` : (e as Error).message);
    }
    usage.calls++;
    usage.inputTokens += res.usage?.input_tokens ?? 0;
    usage.cachedInputTokens += res.usage?.input_tokens_details?.cached_tokens ?? 0;
    usage.outputTokens += res.usage?.output_tokens ?? 0;
    if (res.incomplete_details?.reason === "content_filter") return { texts, refused: true, usage };

    let refused = false;
    const calls: OpenAI.Responses.ResponseFunctionToolCall[] = [];
    for (const item of res.output) {
      if (item.type === "message") {
        for (const part of item.content) {
          if (part.type === "refusal") refused = true;
          if (part.type === "output_text" && part.text.trim()) {
            texts.push(part.text.trim());
            opts.onText?.(part.text.trim());
          }
        }
      }
      if (item.type === "function_call") calls.push(item);
    }
    if (refused) return { texts, refused: true, usage };
    if (calls.length === 0) break;

    input.push(...toResponseInputItems(res.output));
    for (const call of calls) {
      const out = await execSafely(opts.execute, call.name, call.arguments);
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(out.result) });
    }
  }
  return { texts, refused: false, usage };
}

// ---------------------------------------------------------------------------
// Anthropic (Messages API) – alternative provider
// ---------------------------------------------------------------------------

async function runAnthropic(opts: RunOptions): Promise<RunResult> {
  const client = new Anthropic({ maxRetries: 1, timeout: opts.timeoutMs ?? 45_000 });
  const tools: Anthropic.Beta.BetaTool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Beta.BetaTool["input_schema"],
    strict: true,
  }));
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const texts: string[] = [];
  const usage = emptyUsage();

  for (let round = 0; round <= opts.maxRounds; round++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: llmInfo().model,
        max_tokens: opts.maxOutputTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: opts.effort },
        system: opts.system,
        tools,
        messages,
      });
    } catch (e) {
      throw new LlmUnavailableError(e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : (e as Error).message);
    }
    usage.calls++;
    usage.inputTokens += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0);
    usage.cachedInputTokens += res.usage.cache_read_input_tokens ?? 0;
    usage.outputTokens += res.usage.output_tokens;
    if (res.stop_reason === "refusal") return { texts, refused: true, usage };
    for (const b of res.content) {
      if (b.type === "text" && b.text.trim()) {
        texts.push(b.text.trim());
        opts.onText?.(b.text.trim());
      }
    }
    if (res.stop_reason !== "tool_use") break;
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      const out = await execSafely(opts.execute, b.name, b.input);
      results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out.result), is_error: Boolean(out.isError) });
    }
    messages.push({ role: "user", content: results });
  }
  return { texts, refused: false, usage };
}
