import { NextRequest, NextResponse } from "next/server";
import {
  handleConsult,
  SERVICE,
  TOOLS,
  FREE_TOOLS,
  PAID_TOOLS,
  clampPrice,
  getTool,
  ORACLE_CONNECT_HOWTO,
  jsonSchemaFromExample,
  mcpJson,
} from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

function mcpHealthBody(env: ReturnType<typeof oracleEnv>) {
  return {
    ok: true,
    service: SERVICE.name,
    slug: SERVICE.slug,
    version: SERVICE.version,
    wallet_configured: false,
    pay_to_configured: Boolean(env.payTo),
    cdp_auth_configured: Boolean(env.cdpApiKeyId && env.cdpApiKeySecret),
    seller_leak_warning: env.sellerLeakWarning,
    demoMode: env.demoMode,
    network: env.network,
    thesis: SERVICE.thesis,
  };
}

function mcpPricingBody(env: ReturnType<typeof oracleEnv>) {
  return {
    maxPriceUsd: env.maxPriceUsd,
    network: env.network,
    payTo: env.payTo,
    connect: ORACLE_CONNECT_HOWTO,
    free: FREE_TOOLS.map((t) => ({ name: t.name, path: t.httpPath })),
    paid: PAID_TOOLS.map((t) => ({
      name: t.name,
      path: t.httpPath,
      method: t.httpMethod,
      priceUsd: clampPrice(t, undefined, env.maxPriceUsd),
    })),
  };
}

function mcpToolResult(id: unknown, body: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      structuredContent: body,
      content: [{ type: "text" as const, text: JSON.stringify(body) }],
    },
  };
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, payment-signature, x-payment",
    },
  });
}

export function GET() {
  const env = oracleEnv();
  return NextResponse.json(
    {
      ...mcpJson(env),
      transport: "streamable-http",
      endpoint: `${env.publicBaseUrl}/mcp`,
      methods_supported: ["initialize", "tools/list", "tools/call", "notifications/initialized"],
      usage: "Send HTTP POST with JSON-RPC 2.0 payload to this endpoint.",
      documentation: `${env.publicBaseUrl}/llms.txt`,
    },
    {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        "access-control-allow-origin": "*",
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const env = oracleEnv();
  const body = (await req.json().catch(() => ({}))) as {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: { name?: string; arguments?: Record<string, unknown>; _meta?: Record<string, unknown> };
  };
  const id = body.id ?? null;
  if (body.method === "initialize") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: SERVICE.slug, version: SERVICE.version },
          capabilities: { tools: {} },
        },
      },
      {
        headers: { "access-control-allow-origin": "*" },
      },
    );
  }
  if (body.method === "tools/list" || body.method === "notifications/initialized") {
    if (body.method === "notifications/initialized") {
      return new NextResponse(null, {
        status: 202,
        headers: { "access-control-allow-origin": "*" },
      });
    }
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: jsonSchemaFromExample(t.inputExample),
          })),
        },
      },
      {
        headers: { "access-control-allow-origin": "*" },
      },
    );
  }
  if (body.method === "tools/call") {
    const name = body.params?.name ?? "";
    if (name === "oracle_health") {
      return NextResponse.json(mcpToolResult(id, mcpHealthBody(env)), {
        headers: { "access-control-allow-origin": "*" },
      });
    }
    if (name === "oracle_pricing") {
      return NextResponse.json(mcpToolResult(id, mcpPricingBody(env)), {
        headers: { "access-control-allow-origin": "*" },
      });
    }
    if (!getTool(name)) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `UNKNOWN_TOOL:${name}` },
        },
        {
          headers: { "access-control-allow-origin": "*" },
        },
      );
    }
    const result = await handleConsult({
      env,
      toolName: name,
      input: body.params?.arguments ?? {},
      payment: body.params?._meta?.["x402/payment"] ?? null,
      transport: "mcp",
    });
    if (result.status === 402) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            structuredContent: result.body,
            content: [{ type: "text", text: JSON.stringify(result.body) }],
          },
        },
        {
          status: 200,
          headers: { "access-control-allow-origin": "*" },
        },
      );
    }
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          structuredContent: result.body,
          content: [{ type: "text", text: JSON.stringify(result.body) }],
        },
      },
      {
        headers: { "access-control-allow-origin": "*" },
      },
    );
  }
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method ${body.method}` },
    },
    {
      headers: { "access-control-allow-origin": "*" },
    },
  );
}
