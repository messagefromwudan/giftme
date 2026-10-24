import { catalogDocument } from "@/lib/agent";
import { CORS } from "@/lib/http";

export function GET() {
  return Response.json(catalogDocument(), { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}
