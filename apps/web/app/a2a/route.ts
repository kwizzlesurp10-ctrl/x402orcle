import { NextRequest, NextResponse } from "next/server";
import { handleA2aJsonRpc } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const env = oracleEnv();
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 200, headers: { "access-control-allow-origin": "*" } },
    );
  }
  const result = await handleA2aJsonRpc({
    env,
    body: body as {
      jsonrpc?: string;
      id?: unknown;
      method?: string;
      params?: Record<string, unknown>;
    },
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "access-control-allow-origin": "*" },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}
