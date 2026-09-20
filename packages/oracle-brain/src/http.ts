function generateUuid(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import { z } from "zod";
import { clampPrice, getTool, validateToolInput } from "./catalog.js";
import { gatePaidTool } from "./policy.js";
import { maybeLlmConsult } from "./consult.js";
import { buildPaymentRequired, encodePaymentRequired, type PaymentAccept } from "./challenge.js";
import type { OracleEnv } from "./env.js";
import { demoVerify } from "./demo-payment.js";
import { cdpAuthHeaders } from "./cdp-jwt.js";
import { recordChallenge, recordDemandSale } from "./demand.js";
import { recordRevenue } from "./ledger.js";

export type ConsultResult = {
  status: 200 | 400 | 404 | 402;
  headers?: Record<string, string>;
  body: unknown;
};

export type ConsultError = {
  code: "INVALID_REQUEST" | "TOOL_NOT_FOUND";
  message: string;
  issues?: Array<{ path: string; message: string }>;
};

export type FacilitatorVerifyResult = {
  ok: boolean;
  payer?: string;
  transaction?: string;
  reason?: string;
};

const FacilitatorVerifyResponseSchema = z.object({
  isValid: z.boolean(),
  payer: z.string().optional(),
  invalidReason: z.string().optional(),
});

const FacilitatorSettleResponseSchema = z.object({
  success: z.boolean(),
  payer: z.string().optional(),
  transaction: z.string().optional(),
});

function facilitatorBases(env: OracleEnv): string[] {
  const out: string[] = [];
  for (const raw of [env.facilitatorUrl, env.facilitatorFallback]) {
    if (!raw) continue;
    const base = raw.replace(/\/$/, "");
    if (!out.includes(base)) out.push(base);
  }
  return out;
}

async function verifyThenSettleAt(opts: {
  env: OracleEnv;
  base: string;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const payload = {
    x402Version: 2,
    paymentPayload: opts.payment,
    paymentRequirements: opts.requirements,
  };
  const jsonHeaders: Record<string, string> = { "content-type": "application/json" };
  const verifyUrl = `${opts.base}/verify`;
  const headers = {
    ...jsonHeaders,
    ...cdpAuthHeaders({
      apiKeyId: opts.env.cdpApiKeyId,
      apiKeySecret: opts.env.cdpApiKeySecret,
      method: "POST",
      url: verifyUrl,
    }),
  };

  const verifyRes = await opts.fetchImpl(verifyUrl, {
    method: "POST",
    signal: AbortSignal.timeout(opts.env.facilitatorTimeoutMs),
    headers,
    body: JSON.stringify(payload),
  });
  if (verifyRes.status === 401 || verifyRes.status === 403) {
    return { ok: false, reason: "FACILITATOR_AUTH_REQUIRED" };
  }
  if (!verifyRes.ok) {
    return { ok: false, reason: `FACILITATOR_VERIFY_${verifyRes.status}` };
  }
  const verifyJson = FacilitatorVerifyResponseSchema.parse(await verifyRes.json());
  if (!verifyJson.isValid) {
    return { ok: false, payer: verifyJson.payer, reason: verifyJson.invalidReason || "INVALID_PAYMENT" };
  }

  const settleUrl = `${opts.base}/settle`;
  const settleHeaders = {
    ...jsonHeaders,
    ...cdpAuthHeaders({
      apiKeyId: opts.env.cdpApiKeyId,
      apiKeySecret: opts.env.cdpApiKeySecret,
      method: "POST",
      url: settleUrl,
    }),
  };
  const settleRes = await opts.fetchImpl(settleUrl, {
    method: "POST",
    signal: AbortSignal.timeout(opts.env.facilitatorTimeoutMs),
    headers: settleHeaders,
    body: JSON.stringify(payload),
  });
  if (settleRes.status === 401 || settleRes.status === 403) {
    return { ok: false, reason: "FACILITATOR_AUTH_REQUIRED" };
  }
  if (!settleRes.ok) {
    return { ok: false, reason: `FACILITATOR_SETTLE_${settleRes.status}` };
  }
  const settleJson = FacilitatorSettleResponseSchema.parse(await settleRes.json());
  if (!settleJson.success) {
    return { ok: false, reason: "FACILITATOR_SETTLE_FAILED" };
  }
  return {
    ok: true,
    payer: settleJson.payer || verifyJson.payer,
    transaction: settleJson.transaction,
  };
}

export async function facilitatorVerifyThenSettle(opts: {
  env: OracleEnv;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl?: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const bases = facilitatorBases(opts.env);
  let last: FacilitatorVerifyResult = { ok: false, reason: "FACILITATOR_VERIFY_FAILED" };
  for (const base of bases) {
    let result: FacilitatorVerifyResult;
    try {
      result = await verifyThenSettleAt({
        env: opts.env,
        base,
        payment: opts.payment,
        requirements: opts.requirements,
        fetchImpl,
      });
    } catch (error) {
      result = {
        ok: false,
        reason: error instanceof Error && error.name === "TimeoutError"
          ? "FACILITATOR_TIMEOUT"
          : "FACILITATOR_UNAVAILABLE",
      };
    }
    if (result.ok) return result;
    last = result;
    if (
      result.reason === "FACILITATOR_AUTH_REQUIRED" ||
      result.reason === "FACILITATOR_TIMEOUT" ||
      result.reason === "FACILITATOR_UNAVAILABLE" ||
      result.reason?.startsWith("FACILITATOR_VERIFY_")
    ) {
      continue;
    }
    return result;
  }
  return last;
}

export async function handleConsult(opts: {
  env: OracleEnv;
  toolName: string;
  input: Record<string, unknown>;
  payment: unknown | null;
  transport: "http" | "mcp";
  execution?: "challenge" | "execute";
  fetchImpl?: typeof fetch;
}): Promise<ConsultResult> {
  const tool = getTool(opts.toolName);
  if (!tool || tool.tier !== "paid") {
    return {
      status: 404,
      body: {
        code: "TOOL_NOT_FOUND",
        message: `Unknown paid tool: ${opts.toolName}`,
      } satisfies ConsultError,
    };
  }
  const priceUsd = clampPrice(tool, undefined, opts.env.maxPriceUsd);
  const pr = buildPaymentRequired({
    env: opts.env,
    tool,
    priceUsd,
    transport: opts.transport,
  });
  const wwwAuthHeader = `x402 scheme="exact", network="${opts.env.network}", payTo="${opts.env.payTo}"`;
  if (opts.execution === "challenge") {
    recordChallenge(tool.name);
    return {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": encodePaymentRequired(pr),
        "WWW-Authenticate": wwwAuthHeader,
        "Cache-Control": "no-store",
      },
      body: pr,
    };
  }
  const parsedInput = validateToolInput(tool, opts.input);
  if (!parsedInput.success) {
    return {
      status: 400,
      body: {
        code: "INVALID_REQUEST",
        message: `Invalid request for ${tool.name}`,
        issues: parsedInput.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      } satisfies ConsultError,
    };
  }
  const input = parsedInput.data;
  const gate = gatePaidTool({
    toolName: tool.name,
    priceUsd,
    maxPriceUsd: opts.env.maxPriceUsd,
    userText: JSON.stringify(input),
  });
  if (!gate.ok) {
    return { status: 400, body: { code: gate.code, message: gate.message } };
  }
  if (!opts.payment) {
    recordChallenge(tool.name);
    return {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": encodePaymentRequired(pr),
        "WWW-Authenticate": wwwAuthHeader,
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
          headers: {
            "PAYMENT-REQUIRED": encodePaymentRequired(pr),
            "WWW-Authenticate": wwwAuthHeader,
          },
          body: pr,
        };
      }
      const envl = await maybeLlmConsult({
        tool,
        env: opts.env,
        input,
        receipt: {
          tool: tool.name,
          priceUsd,
          network: opts.env.network,
          payTo: opts.env.payTo,
          mode: "demo",
          settlementId: `demo-${generateUuid()}`,
          payer: v.payer,
          paidAt: new Date().toISOString(),
        },
      });
      const revenue = recordRevenue({
        productId: tool.name,
        network: opts.env.network,
        amountUsd: priceUsd,
        payer: v.payer,
        payTo: opts.env.payTo,
        mode: "demo",
        operatorWallets: opts.env.operatorWallets,
      });
      recordDemandSale({
        resource: tool.name,
        amountUsd: priceUsd,
        isOperatorSettle: revenue?.is_operator_settle ?? null,
      });
      return {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": encodePaymentResponse({
            transaction: envl.receipt?.settlementId,
            network: opts.env.network,
            payer: v.payer,
          }),
          "Cache-Control": "no-store",
        },
        body: envl,
      };
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
        headers: {
          "PAYMENT-REQUIRED": encodePaymentRequired(pr),
          "WWW-Authenticate": wwwAuthHeader,
        },
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
      input,
      receipt: {
        tool: tool.name,
        priceUsd,
        network: opts.env.network,
        payTo: opts.env.payTo,
        mode: "live",
        settlementId: live.transaction || generateUuid(),
        transaction: live.transaction,
        payer: live.payer,
        paidAt: new Date().toISOString(),
      },
    });
    const revenue = recordRevenue({
      productId: tool.name,
      network: opts.env.network,
      amountUsd: priceUsd,
      tx: live.transaction,
      payer: live.payer,
      payTo: opts.env.payTo,
      mode: "live",
      operatorWallets: opts.env.operatorWallets,
    });
    recordDemandSale({
      resource: tool.name,
      amountUsd: priceUsd,
      isOperatorSettle: revenue?.is_operator_settle ?? null,
    });
    return {
      status: 200,
      headers: {
        "PAYMENT-RESPONSE": encodePaymentResponse({
          transaction: live.transaction,
          network: opts.env.network,
          payer: live.payer,
        }),
        "Cache-Control": "no-store",
      },
      body: envl,
    };
  }
  return { status: 200, body: { ok: true } };
}

function encodePaymentResponse(input: {
  transaction?: string;
  network: string;
  payer?: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      success: true,
      transaction: input.transaction,
      network: input.network,
      payer: input.payer,
    }),
    "utf8",
  ).toString("base64");
}
