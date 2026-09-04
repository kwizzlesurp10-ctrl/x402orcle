import { randomUUID } from "node:crypto";
import { clampPrice, requireTool } from "./catalog.js";
import { gatePaidTool } from "./policy.js";
import { maybeLlmConsult } from "./consult.js";
import { buildPaymentRequired, encodePaymentRequired } from "./challenge.js";
import type { OracleEnv } from "./env.js";
import { demoVerify } from "./demo-payment.js";

export type ConsultResult = {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
};

export async function handleConsult(opts: {
  env: OracleEnv;
  toolName: string;
  input: Record<string, unknown>;
  payment: unknown | null;
  transport: "http" | "mcp";
}): Promise<ConsultResult> {
  const tool = requireTool(opts.toolName);
  const priceUsd = clampPrice(tool, undefined, opts.env.maxPriceUsd);
  const gate = gatePaidTool({
    toolName: tool.name,
    priceUsd,
    maxPriceUsd: opts.env.maxPriceUsd,
    userText: JSON.stringify(opts.input),
  });
  if (!gate.ok) {
    return { status: 400, body: { code: gate.code, message: gate.message } };
  }
  const pr = buildPaymentRequired({
    env: opts.env,
    tool,
    priceUsd,
    transport: opts.transport,
  });
  if (tool.tier === "paid" && !opts.payment) {
    return {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": encodePaymentRequired(pr),
        "Cache-Control": "no-store",
      },
      body: pr,
    };
  }
  if (tool.tier === "paid") {
    if (opts.env.demoMode) {
      const v = demoVerify(opts.payment, opts.env.network, opts.env.payTo);
      if (!v.ok) {
        return {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encodePaymentRequired(pr) },
          body: pr,
        };
      }
      const envl = await maybeLlmConsult({
        tool,
        env: opts.env,
        input: opts.input,
        receipt: {
          tool: tool.name,
          priceUsd,
          network: opts.env.network,
          payTo: opts.env.payTo,
          mode: "demo",
          settlementId: `demo-${randomUUID()}`,
          payer: v.payer,
          paidAt: new Date().toISOString(),
        },
      });
      return { status: 200, body: envl };
    }
    return {
      status: 402,
      headers: { "PAYMENT-REQUIRED": encodePaymentRequired(pr) },
      body: {
        ...pr,
        note: "Live PAYMENT-SIGNATURE must verify via the CDP facilitator. DEMO_MODE=true for local receipts.",
      },
    };
  }
  return { status: 200, body: { ok: true } };
}
