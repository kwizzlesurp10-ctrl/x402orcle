import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { FREE_TOOLS, PAID_TOOLS, TOOLS } from "../../packages/oracle-brain/src/catalog";

const STATIC_API = new Set(["/api/health", "/api/pricing"]);

function consultApiIndex() {
  return {
    code: "CONSULT_TOOL_REQUIRED",
    message: "Specify a consult tool name: GET or POST /api/consult/{tool}",
    tools: TOOLS.map((t) => ({
      name: t.name,
      tier: t.tier,
      path: t.httpPath,
      method: t.httpMethod,
    })),
    free: FREE_TOOLS.map((t) => t.name),
    paid: PAID_TOOLS.map((t) => t.name),
    openapi: "/openapi.json",
  };
}

function apiRouteNotFound(path: string) {
  return {
    code: "NOT_FOUND",
    message: `No API route at ${path}`,
    discovery: "/openapi.json",
    health: "/api/health",
    pricing: "/api/pricing",
    consult: "/api/consult/{tool}",
  };
}

function normalizedPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function middleware(request: NextRequest) {
  const path = normalizedPath(request.nextUrl.pathname);
  if (!path.startsWith("/api")) {
    return NextResponse.next();
  }

  if (path === "/api/consult") {
    return NextResponse.json(consultApiIndex(), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (STATIC_API.has(path)) {
    return NextResponse.next();
  }

  const consultMatch = /^\/api\/consult\/([^/]+)$/.exec(path);
  if (consultMatch) {
    const tool = consultMatch[1]!;
    const known = TOOLS.some((t) => t.name === tool);
    if (!known) {
      return NextResponse.json(
        {
          ...consultApiIndex(),
          code: "UNKNOWN_TOOL",
          message: `UNKNOWN_TOOL:${tool}`,
        },
        { status: 404 },
      );
    }
    return NextResponse.next();
  }

  return NextResponse.json(apiRouteNotFound(path), { status: 404 });
}

export const config = {
  matcher: ["/api/:path*"],
};
