import { NextRequest, NextResponse } from "next/server";
import {
  handleConsult,
  SERVICE,
  TOOLS,
  PAID_TOOLS,
  ORACLE_CONNECT_HOWTO,
  mcpJson,
  decodePaymentHeader,
} from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

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
            inputSchema: t.inputSchema,
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
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify({ ok: true, wallet_configured: false }) }] },
        },
        {
          headers: { "access-control-allow-origin": "*" },
        },
      );
    }
    if (name === "oracle_pricing") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ paid: PAID_TOOLS.map((t) => t.name), connect: ORACLE_CONNECT_HOWTO }),
              },
            ],
          },
        },
        {
          headers: { "access-control-allow-origin": "*" },
        },
      );
    }
    const paymentHeader =
      req.headers.get("payment-signature") ||
      req.headers.get("PAYMENT-SIGNATURE") ||
      req.headers.get("Payment-Signature") ||
      req.headers.get("x-payment") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    const payment =
      body.params?._meta?.["x402/payment"] ??
      (paymentHeader ? decodePaymentHeader(paymentHeader) : null);
    const result = await handleConsult({
      env,
      toolName: name,
      input: body.params?.arguments ?? {},
      payment,
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
    if (result.status !== 200) {
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
          headers: {
            "access-control-allow-origin": "*",
            ...(result.headers ?? {}),
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
        headers: {
          "access-control-allow-origin": "*",
          ...(result.headers ?? {}),
        },
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
