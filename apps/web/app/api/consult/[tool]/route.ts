import { NextRequest, NextResponse } from "next/server";
import {
  decodePaymentHeader,
  getTool,
  handleConsult,
  isPaidConsultTool,
} from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";

function paymentHeaderFrom(req: NextRequest): string {
  return req.headers.get("payment-signature") || req.headers.get("PAYMENT-SIGNATURE") || "";
}

async function consult(req: NextRequest, tool: string) {
  const env = oracleEnv();
  const spec = getTool(tool);
  if (!spec) {
    return NextResponse.json({ code: "UNKNOWN_TOOL", message: `UNKNOWN_TOOL:${tool}` }, { status: 404 });
  }

  const paymentHeader = paymentHeaderFrom(req);
  const hasPaymentHeader = Boolean(paymentHeader.trim());

  if (isPaidConsultTool(tool) && !hasPaymentHeader) {
    const result = await handleConsult({
      env,
      toolName: tool,
      input: {},
      payment: null,
      transport: "http",
    });
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }

  let input: Record<string, unknown> = {};
  if (req.method === "POST") {
    const raw = await req.text();
    if (raw.trim()) {
      try {
        input = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { code: "INVALID_REQUEST", message: "Request body must be valid JSON" },
          { status: 400 },
        );
      }
    }
  } else {
    input = Object.fromEntries(req.nextUrl.searchParams.entries());
  }

  const payment = hasPaymentHeader
    ? decodePaymentHeader(paymentHeader)
    : (input.payment as unknown) ?? null;

  const result = await handleConsult({
    env,
    toolName: tool,
    input,
    payment,
    transport: "http",
  });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const { tool } = await ctx.params;
  return consult(req, tool);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const { tool } = await ctx.params;
  return consult(req, tool);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Payment-Signature, PAYMENT-SIGNATURE, X-Payment, x402-version",
      "Access-Control-Expose-Headers":
        "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Payment-Required, Payment-Response, x402-version",
    },
  });
}
