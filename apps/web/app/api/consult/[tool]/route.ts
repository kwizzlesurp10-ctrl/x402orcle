import { NextRequest, NextResponse } from "next/server";
import { handleConsult, decodePaymentHeader } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";

async function consult(req: NextRequest, tool: string) {
  const env = oracleEnv();
  const paymentHeader =
    req.headers.get("payment-signature") || req.headers.get("PAYMENT-SIGNATURE") || "";
  let input: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      input = (await req.json()) as Record<string, unknown>;
    } catch {
      input = {};
    }
  } else {
    input = Object.fromEntries(req.nextUrl.searchParams.entries());
  }
  const payment = paymentHeader ? decodePaymentHeader(paymentHeader) : (input.payment as unknown) ?? null;
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
