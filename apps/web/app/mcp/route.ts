import { NextRequest, NextResponse } from "next/server";
import {
  handleConsult,
  SERVICE,
  FREE_TOOLS,
  PAID_TOOLS,
  clampPrice,
  getTool,
  ORACLE_CONNECT_HOWTO,
  mcpJson,
  mcpToolDefinitions,
} from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS, HEAD",
  "access-control-allow-headers":
    "content-type, authorization, payment-signature, PAYMENT-SIGNATURE, x-payment, X-Payment, x402-version, mcp-session-id, Mcp-Session-Id, x402-authorization, x-payment-signature",
  "access-control-expose-headers":
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Payment-Required, Payment-Response, x402-version, mcp-session-id, Mcp-Session-Id, WWW-Authenticate",
};

function getEffectiveBase(req: NextRequest, env: ReturnType<typeof oracleEnv>): { baseUrl: string; mcpUrl: string } {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const baseUrl = host ? `${proto}://${host}` : env.publicBaseUrl;
  return {
    baseUrl,
    mcpUrl: `${baseUrl}/mcp`,
  };
}

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
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const env = oracleEnv();
  const { baseUrl, mcpUrl } = getEffectiveBase(req, env);
  const accept = req.headers.get("accept") ?? "";
  const url = new URL(req.url);

  // 1. Explicit or detected 402 probe: emit 402 challenge with catalog embedded
  const is402Probe =
    url.searchParams.get("probe") === "402" ||
    req.headers.has("x-x402-probe") ||
    req.headers.get("x402-probe") === "true" ||
    accept.includes("application/x402+json");

  if (is402Probe) {
    const result = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: {},
      payment: null,
      transport: "http",
      resourceUrl: mcpUrl,
    });

    const paymentRequiredVal =
      result.headers?.["PAYMENT-REQUIRED"] || result.headers?.["payment-required"];

    return NextResponse.json(
      {
        ...((result.body ?? {}) as Record<string, unknown>),
        catalog: {
          ...mcpJson(env),
          transport: "streamable-http",
          endpoint: mcpUrl,
          methods_supported: ["initialize", "tools/list", "tools/call", "notifications/initialized"],
        },
      },
      {
        status: 402,
        headers: {
          ...CORS_HEADERS,
          ...(paymentRequiredVal
            ? {
                "PAYMENT-REQUIRED": paymentRequiredVal,
                "payment-required": paymentRequiredVal,
              }
            : {}),
          "cache-control": "no-store",
        },
      },
    );
  }

  // 2. Pure SSE handshake (Accept: text/event-stream without application/json):
  if (accept.toLowerCase().includes("text/event-stream") && !accept.toLowerCase().includes("application/json")) {
    return new Response(`event: endpoint\ndata: ${mcpUrl}\n\n`, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        ...CORS_HEADERS,
      },
    });
  }

  // 3. Standard MCP JSON server card (browsers, crawlers, validators, tools/list inspection):
  return NextResponse.json(
    {
      ...mcpJson(env),
      transport: "streamable-http",
      endpoint: mcpUrl,
      methods_supported: ["initialize", "tools/list", "tools/call", "notifications/initialized"],
      usage:
        "Send HTTP POST with JSON-RPC 2.0 payload to this endpoint. GET returns this catalog; SSE (text/event-stream) returns endpoint event.",
      documentation: `${baseUrl}/llms.txt`,
    },
    {
      headers: {
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        Vary: "Accept",
        ...CORS_HEADERS,
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const env = oracleEnv();
  const { baseUrl, mcpUrl } = getEffectiveBase(req, env);
  const body = (await req.json().catch(() => ({}))) as {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: {
      name?: string;
      arguments?: Record<string, unknown>;
      _meta?: Record<string, unknown>;
      protocolVersion?: string;
    };
  };

  // Dual-mode x402 probe: if request lacks JSON-RPC method, emit 402 challenge
  if (!body.jsonrpc || !body.method) {
    const result = await handleConsult({
      env,
      toolName: "oracle_ask",
      input: {},
      payment: null,
      transport: "http",
      resourceUrl: mcpUrl,
    });
    const paymentRequiredVal =
      result.headers?.["PAYMENT-REQUIRED"] || result.headers?.["payment-required"];

    return NextResponse.json(result.body, {
      status: 402,
      headers: {
        ...CORS_HEADERS,
        ...(paymentRequiredVal
          ? {
              "PAYMENT-REQUIRED": paymentRequiredVal,
              "payment-required": paymentRequiredVal,
            }
          : {}),
        "cache-control": "no-store",
      },
    });
  }

  const id = body.id ?? null;
  const sessionId =
    req.headers.get("mcp-session-id") || req.headers.get("Mcp-Session-Id") || `session-${Date.now()}`;

  if (body.method === "initialize") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: body.params?.protocolVersion || "2025-03-26",
          serverInfo: { name: SERVICE.slug, version: SERVICE.version },
          capabilities: { tools: {} },
        },
      },
      {
        headers: {
          ...CORS_HEADERS,
          "mcp-session-id": sessionId,
          "Mcp-Session-Id": sessionId,
        },
      },
    );
  }

  if (body.method === "ping") {
    return NextResponse.json(
      { jsonrpc: "2.0", id, result: {} },
      { headers: { ...CORS_HEADERS, "mcp-session-id": sessionId } },
    );
  }

  if (body.method === "notifications/initialized") {
    return new NextResponse(null, {
      status: 202,
      headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
    });
  }

  if (body.method === "tools/list") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          tools: mcpToolDefinitions(),
        },
      },
      {
        headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
      },
    );
  }

  if (body.method === "tools/call") {
    const name = body.params?.name ?? "";
    if (name === "oracle_health") {
      return NextResponse.json(mcpToolResult(id, mcpHealthBody(env)), {
        headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
      });
    }
    if (name === "oracle_pricing") {
      return NextResponse.json(mcpToolResult(id, mcpPricingBody(env)), {
        headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
      });
    }
    if (!getTool(name)) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: JSON.stringify({ error: `UNKNOWN_TOOL:${name}` }) }],
          },
        },
        {
          headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
        },
      );
    }

    const paymentSig =
      body.params?._meta?.["x402/payment"] ??
      req.headers.get("payment-signature") ??
      req.headers.get("PAYMENT-SIGNATURE") ??
      null;

    const result = await handleConsult({
      env,
      toolName: name,
      input: body.params?.arguments ?? {},
      payment: paymentSig,
      transport: "mcp",
    });

    if (result.status === 402) {
      const paymentRequiredVal =
        result.headers?.["PAYMENT-REQUIRED"] || result.headers?.["payment-required"];
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            structuredContent: result.body,
            content: [{ type: "text", text: JSON.stringify(result.body) }],
            _meta: { "x402/payment-required": result.body },
          },
        },
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "mcp-session-id": sessionId,
            ...(paymentRequiredVal
              ? {
                  "PAYMENT-REQUIRED": paymentRequiredVal,
                  "payment-required": paymentRequiredVal,
                }
              : {}),
          },
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
        headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
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
      headers: { ...CORS_HEADERS, "mcp-session-id": sessionId },
    },
  );
}
