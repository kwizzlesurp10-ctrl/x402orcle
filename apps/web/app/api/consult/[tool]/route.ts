import { NextRequest, NextResponse } from "next/server";
import { handleConsult, decodePaymentHeader } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";

async function consult(req: NextRequest, tool: string, execution: "challenge" | "execute") {
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
  if (execution === "execute") {
    try {
      const body: unknown = await req.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json(
          { code: "INVALID_REQUEST", message: "Request body must be a JSON object" },
          { status: 400 },
        );
      }
      input = body as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }
  }
  const payment = paymentHeader ? decodePaymentHeader(paymentHeader) : (input.payment as unknown) ?? null;
  delete input.payment;
  const result = await handleConsult({
    env,
    toolName: tool,
    input,
    payment,
    transport: "http",
    execution,
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
  return consult(req, tool, "challenge");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tool: string }> },
) {
  const { tool } = await ctx.params;
  return consult(req, tool, "execute");
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
