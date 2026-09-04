import { randomUUID } from "node:crypto";
import { clampPrice, requireTool } from "./catalog.js";
import { gatePaidTool } from "./policy.js";
import { maybeLlmConsult } from "./consult.js";
import { buildPaymentRequired, encodePaymentRequired, type PaymentAccept } from "./challenge.js";
import type { OracleEnv } from "./env.js";
import { demoVerify } from "./demo-payment.js";

export type ConsultResult = {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
};

export type FacilitatorVerifyResult = {
  ok: boolean;
  payer?: string;
  transaction?: string;
  reason?: string;
};

export async function facilitatorVerifyThenSettle(opts: {
  env: OracleEnv;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl?: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.env.facilitatorUrl.replace(/\/$/, "");
  const payload = {
    x402Version: 2,
    paymentPayload: opts.payment,
    paymentRequirements: opts.requirements,
  };
  const headers: Record<string, string> = { "content-type": "application/json" };

  const verifyRes = await fetchImpl(`${base}/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (verifyRes.status === 401 || verifyRes.status === 403) {
    return { ok: false, reason: "FACILITATOR_AUTH_REQUIRED" };
  }
  if (!verifyRes.ok) {
    return { ok: false, reason: `FACILITATOR_VERIFY_${verifyRes.status}` };
  }
  const verifyJson = (await verifyRes.json()) as {
    isValid?: boolean;
    payer?: string;
    invalidReason?: string;
  };
  if (!verifyJson.isValid) {
    return { ok: false, payer: verifyJson.payer, reason: verifyJson.invalidReason || "INVALID_PAYMENT" };
  }

  const settleRes = await fetchImpl(`${base}/settle`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (settleRes.status === 401 || settleRes.status === 403) {
    return { ok: false, reason: "FACILITATOR_AUTH_REQUIRED" };
  }
  if (!settleRes.ok) {
    return { ok: false, reason: `FACILITATOR_SETTLE_${settleRes.status}` };
  }
  const settleJson = (await settleRes.json()) as {
    success?: boolean;
    payer?: string;
    transaction?: string;
  };
  if (!settleJson.success) {
    return { ok: false, reason: "FACILITATOR_SETTLE_FAILED" };
  }
  return {
    ok: true,
    payer: settleJson.payer || verifyJson.payer,
    transaction: settleJson.transaction,
  };
}

export async function handleConsult(opts: {
  env: OracleEnv;
  toolName: string;
  input: Record<string, unknown>;
  payment: unknown | null;
  transport: "http" | "mcp";
  fetchImpl?: typeof fetch;
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

    const live = await facilitatorVerifyThenSettle({
      env: opts.env,
      payment: opts.payment,
      requirements: pr.accepts[0]!,
      fetchImpl: opts.fetchImpl,
    });
    if (!live.ok) {
      return {
        status: 402,
        headers: { "PAYMENT-REQUIRED": encodePaymentRequired(pr) },
        body: {
          ...pr,
          facilitator_error: live.reason,
          note:
            live.reason === "FACILITATOR_AUTH_REQUIRED"
              ? "CDP facilitator verify/settle needs CDP_API_KEY_ID + CDP_API_KEY_SECRET on the seller host (not a wallet key)."
              : "Payment did not verify/settle. Do not retry blindly; inspect facilitator_error.",
        },
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
        mode: "live",
        settlementId: live.transaction || randomUUID(),
        transaction: live.transaction,
        payer: live.payer,
        paidAt: new Date().toISOString(),
      },
    });
    return { status: 200, body: envl };
  }
  return { status: 200, body: { ok: true } };
}
