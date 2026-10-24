import { randomBytes } from "node:crypto";
import { z } from "zod";
import { runLlmAgent, runScriptedAgent, SCENARIOS, type DemoEvent } from "@/lib/agent-demo";
import { llmConfigured } from "@/lib/llm";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { json, readJson, tooMany } from "@/lib/http";

export const maxDuration = 120;

const schema = z.object({ scenario: z.string().max(20), lang: z.enum(["ro", "en"]).default("ro") });

// Streams the demo agent's steps as NDJSON. Each run costs model tokens and sends a real
// confirmation email, so it is limited per visitor and per day.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await readJson(req).catch(() => null));
  const scenario = parsed.success ? SCENARIOS.find((s) => s.id === parsed.data.scenario) : undefined;
  if (!parsed.success || !scenario) return json({ error: "INVALID_INPUT" }, 400);

  const perIp = await rateLimit({ name: "demo", max: 6, windowSec: 600 }, clientIp(req.headers));
  if (perIp) return tooMany(perIp);
  const daily = await rateLimit({ name: "demo-daily", max: 80, windowSec: 86_400 }, "all");
  if (daily) return tooMany(daily);

  const origin = new URL(req.url).origin;
  const runId = randomBytes(4).toString("hex");
  const lang = parsed.data.lang;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (e: DemoEvent) => controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
      try {
        const ran = await runLlmAgent(scenario, origin, lang, emit, runId);
        if (!ran) {
          const note = llmConfigured()
            ? lang === "ro"
              ? "Serviciul AI nu răspunde acum; rulează agentul scriptat, cu aceleași apeluri reale."
              : "The AI service isn't responding; running the scripted agent with the same real calls."
            : lang === "ro"
              ? "Cheia pentru modelul AI nu este configurată: rulează agentul scriptat, cu aceleași apeluri reale către API."
              : "No AI model key configured: running the scripted agent, with the same real API calls.";
          await runScriptedAgent(scenario, origin, lang, emit, runId, note);
        }
      } catch (e) {
        emit({ type: "error", message: (e as Error).message.slice(0, 200) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
