import { NextResponse, type NextRequest } from "next/server";
import { BOXES } from "@/lib/catalog";

const BOX_SLUGS = new Set(BOXES.map((b) => b.slug));

// Romanian is served at the root (/cutii/gm-01/), English under /en/.
// Internally every page lives in app/[lang], so root paths are rewritten to /ro/….
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // Box pages are partially prerendered, so an unknown slug would stream a 404 page with
  // status 200. Send unknown slugs to the catch-all instead, which returns a real 404.
  const box = pathname.match(/^\/(?:(ro|en)\/)?cutii\/([^/]+)\/?$/);
  if (box && !BOX_SLUGS.has(box[2])) {
    url.pathname = `/${box[1] ?? "ro"}/404/`;
    return NextResponse.rewrite(url);
  }

  if (/^\/(ro|en)(\/|$)/.test(pathname)) return NextResponse.next();

  url.pathname = `/ro${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals, APIs, the MCP endpoint, .well-known, the static RSVP page
  // and any path with a file extension (catalog.json, llms.txt, images…).
  matcher: ["/((?!_next|_vercel|api|mcp|\\.well-known|confirma-prezenta|.*\\..*).*)"],
};
