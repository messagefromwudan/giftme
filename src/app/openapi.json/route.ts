import { openApiDocument } from "@/lib/agent-docs";
import { CORS } from "@/lib/http";

export function GET() {
  return Response.json(openApiDocument(), { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}
