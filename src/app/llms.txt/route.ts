import { llmsTxt } from "@/lib/agent-docs";
import { CORS } from "@/lib/http";

export function GET() {
  return new Response(llmsTxt(), {
    headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
