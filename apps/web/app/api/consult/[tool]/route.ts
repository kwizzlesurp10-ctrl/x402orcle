import { NextRequest, NextResponse } from "next/server";
import { handleConsult, decodePaymentHeader } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";

async function consult(req: NextRequest, tool: string) {
  const env = oracleEnv();
  const paymentHeader =
    req.headers.get("payment-signature") ||
    req.headers.get("PAYMENT-SIGNATURE") ||
    req.headers.get("Payment-Signature") ||
    req.headers.get("payment") ||
    req.headers.get("Payment") ||
    req.headers.get("x-payment") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
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
  const headers = new Headers(result.headers || {});
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Expose-Headers",
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Payment-Required, Payment-Response, WWW-Authenticate, x402-version",
  );
  return NextResponse.json(result.body, { status: result.status, headers });
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
