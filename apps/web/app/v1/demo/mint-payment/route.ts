import { NextRequest, NextResponse } from "next/server";
import {
  buildDemoPaymentPayload,
  buildPaymentRequired,
  clampPrice,
  getTool,
} from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const env = oracleEnv();
  if (!env.demoMode) {
    return NextResponse.json({ code: "DEMO_DISABLED" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { tool?: string; payer?: string };
  const toolName = body.tool || "oracle_ask";
  const tool = getTool(toolName);
  if (!tool || tool.tier !== "paid") {
    return NextResponse.json(
      { code: "TOOL_NOT_FOUND", message: `Unknown paid tool: ${toolName}` },
      { status: 404 },
    );
  }
  const pr = buildPaymentRequired({
    env,
    tool,
    priceUsd: clampPrice(tool, undefined, env.maxPriceUsd),
  });
  const payload = buildDemoPaymentPayload({
    accepts: pr.accepts[0]!,
    payer: body.payer,
    resourceUrl: pr.resource.url,
  });
  return NextResponse.json({
    payment: payload,
    payment_signature_header: Buffer.from(JSON.stringify(payload)).toString("base64"),
  });
}
