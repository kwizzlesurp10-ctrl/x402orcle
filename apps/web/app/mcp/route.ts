import { NextRequest, NextResponse } from "next/server";
import {
  handleConsult,
  SERVICE,
  TOOLS,
  PAID_TOOLS,
  ORACLE_CONNECT_HOWTO,
} from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: SERVICE.slug, version: SERVICE.version },
        capabilities: { tools: {} },
      },
    });
  }
  if (body.method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: { type: "object", additionalProperties: true },
        })),
      },
    });
  }
  if (body.method === "tools/call") {
    const name = body.params?.name ?? "";
    if (name === "oracle_health") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify({ ok: true, wallet_configured: false }) }] },
      });
    }
    if (name === "oracle_pricing") {
      return NextResponse.json({
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
      });
    }
    const result = await handleConsult({
      env,
      toolName: name,
      input: body.params?.arguments ?? {},
      payment: body.params?._meta?.["x402/payment"] ?? null,
      transport: "mcp",
    });
    if (result.status === 402) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          structuredContent: result.body,
          content: [{ type: "text", text: JSON.stringify(result.body) }],
        },
      });
    }
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        structuredContent: result.body,
        content: [{ type: "text", text: JSON.stringify(result.body) }],
      },
    });
  }
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unknown method ${body.method}` },
  });
}
