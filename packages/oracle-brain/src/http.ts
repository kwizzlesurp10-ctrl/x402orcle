import { randomUUID } from "node:crypto";
import { clampPrice, requireTool } from "./catalog.js";
import { gatePaidTool } from "./policy.js";
import { maybeLlmConsult } from "./consult.js";
import { buildPaymentRequired, encodePaymentRequired, type PaymentAccept } from "./challenge.js";
import type { OracleEnv } from "./env.js";
import { demoVerify } from "./demo-payment.js";
import { cdpAuthHeaders } from "./cdp-jwt.js";
import { validateConsultInput } from "./validate-input.js";
import {
  backfillDiscovery,
  bazaarIndexingLogLine,
  bazaarIndexingStatus,
  type BackfillResult,
  type BazaarIndexingStatus,
} from "./bazaar-indexing.js";

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
  /** Bazaar indexing outcome reported by the facilitator on settle. */
  bazaarIndexing?: BazaarIndexingStatus;
};

/**
 * CDP only catalogs a settled payment whose PaymentPayload carries
 * `resource` and the echoed `extensions.bazaar`. Buyers often omit both, so
 * copy them from our own advertised challenge (never overwriting buyer data).
 * Returns a copy; the buyer's decoded header object is not mutated.
 */
/** Settle outcome wins; fall back to what verify reported; else not_reported. */
export function preferIndexing(
  settle: BazaarIndexingStatus | undefined,
  verify: BazaarIndexingStatus | undefined,
): BazaarIndexingStatus {
  if (settle && settle.status !== "not_reported") return settle;
  if (verify && verify.status !== "not_reported") return { ...verify, source: `verify:${verify.source}` };
  return settle ?? { status: "not_reported", source: "none" };
}

export function withDiscoveryBackfill(
  payment: unknown,
  pr: ReturnType<typeof buildPaymentRequired>,
): { payment: unknown; backfilled: BackfillResult } {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    return { payment, backfilled: { resource: false, bazaar: false } };
  }
  const copy = structuredClone(payment) as Parameters<typeof backfillDiscovery>[0];
  const backfilled = backfillDiscovery(copy, { resource: pr.resource, bazaar: pr.extensions?.bazaar });
  return { payment: copy, backfilled };
}

function facilitatorBases(env: OracleEnv): string[] {
  const out: string[] = [];
  for (const raw of [env.facilitatorUrl, env.facilitatorFallback]) {
    if (!raw) continue;
    const base = raw.replace(/\/$/, "");
    if (!out.includes(base)) out.push(base);
  }
  return out;
}

function paymentPayload(env: OracleEnv, payment: unknown, requirements: PaymentAccept) {
  return {
    x402Version: 2,
    paymentPayload: payment,
    paymentRequirements: requirements,
  };
}

async function verifyAt(opts: {
  env: OracleEnv;
  base: string;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const verifyUrl = `${opts.base}/verify`;
  const headers = {
    "content-type": "application/json",
    ...cdpAuthHeaders({
      apiKeyId: opts.env.cdpApiKeyId,
      apiKeySecret: opts.env.cdpApiKeySecret,
      method: "POST",
      url: verifyUrl,
    }),
  };
  const verifyRes = await opts.fetchImpl(verifyUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(paymentPayload(opts.env, opts.payment, opts.requirements)),
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
    extensions?: Record<string, unknown>;
  };
  // Facilitators may report the Bazaar outcome on verify, settle, or both.
  const bazaarIndexing = bazaarIndexingStatus({
    extensionResponsesHeader: verifyRes.headers?.get?.("EXTENSION-RESPONSES") ?? null,
    responseBody: verifyJson,
  });
  if (!verifyJson.isValid) {
    return {
      ok: false,
      payer: verifyJson.payer,
      reason: verifyJson.invalidReason || "INVALID_PAYMENT",
      bazaarIndexing,
    };
  }
  return { ok: true, payer: verifyJson.payer, bazaarIndexing };
}

async function settleAt(opts: {
  env: OracleEnv;
  base: string;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const settleUrl = `${opts.base}/settle`;
  const headers = {
    "content-type": "application/json",
    ...cdpAuthHeaders({
      apiKeyId: opts.env.cdpApiKeyId,
      apiKeySecret: opts.env.cdpApiKeySecret,
      method: "POST",
      url: settleUrl,
    }),
  };
  const settleRes = await opts.fetchImpl(settleUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(paymentPayload(opts.env, opts.payment, opts.requirements)),
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
    extensions?: Record<string, unknown>;
  };
  const bazaarIndexing = bazaarIndexingStatus({
    extensionResponsesHeader: settleRes.headers?.get?.("EXTENSION-RESPONSES") ?? null,
    responseBody: settleJson,
  });
  if (!settleJson.success) {
    return { ok: false, reason: "FACILITATOR_SETTLE_FAILED", bazaarIndexing };
  }
  return {
    ok: true,
    payer: settleJson.payer,
    transaction: settleJson.transaction,
    bazaarIndexing,
  };
}

async function verifyThenSettleAt(opts: {
  env: OracleEnv;
  base: string;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const verified = await verifyAt(opts);
  if (!verified.ok) return verified;
  const settled = await settleAt(opts);
  if (!settled.ok) return settled;
  return {
    ok: true,
    payer: settled.payer || verified.payer,
    transaction: settled.transaction,
    bazaarIndexing: preferIndexing(settled.bazaarIndexing, verified.bazaarIndexing),
  };
}

export async function facilitatorVerify(opts: {
  env: OracleEnv;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl?: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const bases = facilitatorBases(opts.env);
  let last: FacilitatorVerifyResult = { ok: false, reason: "FACILITATOR_VERIFY_FAILED" };
  for (const base of bases) {
    const result = await verifyAt({
      env: opts.env,
      base,
      payment: opts.payment,
      requirements: opts.requirements,
      fetchImpl,
    });
    if (result.ok) return result;
    last = result;
    if (result.reason === "FACILITATOR_AUTH_REQUIRED" || result.reason?.startsWith("FACILITATOR_VERIFY_")) {
      continue;
    }
    return result;
  }
  return last;
}

export async function facilitatorSettle(opts: {
  env: OracleEnv;
  payment: unknown;
  requirements: PaymentAccept;
  fetchImpl?: typeof fetch;
}): Promise<FacilitatorVerifyResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const bases = facilitatorBases(opts.env);
  let last: FacilitatorVerifyResult = { ok: false, reason: "FACILITATOR_SETTLE_FAILED" };
  for (const base of bases) {
    const result = await settleAt({
      env: opts.env,
      base,
      payment: opts.payment,
      requirements: opts.requirements,
      fetchImpl,
    });
    if (result.ok) return result;
    last = result;
    if (result.reason === "FACILITATOR_AUTH_REQUIRED" || result.reason?.startsWith("FACILITATOR_SETTLE_")) {
      continue;
    }
    return result;
  }
  return last;
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
    const result = await verifyThenSettleAt({
      env: opts.env,
      base,
      payment: opts.payment,
      requirements: opts.requirements,
      fetchImpl,
    });
    if (result.ok) return result;
    last = result;
    if (result.reason === "FACILITATOR_AUTH_REQUIRED" || result.reason?.startsWith("FACILITATOR_VERIFY_")) {
      continue;
    }
    return result;
  }
  return last;
}

function paymentChallengeResult(pr: ReturnType<typeof buildPaymentRequired>): ConsultResult {
  return {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": encodePaymentRequired(pr),
      "Cache-Control": "no-store",
    },
    body: pr,
  };
}

function validatePaidInput(opts: {
  tool: ReturnType<typeof requireTool>;
  env: OracleEnv;
  priceUsd: number;
  input: Record<string, unknown>;
}): ConsultResult | { ok: true; input: Record<string, unknown> } {
  const validated = validateConsultInput(opts.tool, opts.input);
  if (!validated.ok) {
    return {
      status: 400,
      body: {
        code: validated.code,
        message: validated.message,
        issues: validated.issues,
      },
    };
  }
  const gate = gatePaidTool({
    toolName: opts.tool.name,
    priceUsd: opts.priceUsd,
    maxPriceUsd: opts.env.maxPriceUsd,
    userText: JSON.stringify(validated.input),
  });
  if (!gate.ok) {
    return { status: 400, body: { code: gate.code, message: gate.message } };
  }
  return { ok: true, input: validated.input };
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
  const pr = buildPaymentRequired({
    env: opts.env,
    tool,
    priceUsd,
    transport: opts.transport,
  });

  if (tool.tier === "paid" && !opts.payment) {
    return paymentChallengeResult(pr);
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
      const checked = validatePaidInput({ tool, env: opts.env, priceUsd, input: opts.input });
      if (!("ok" in checked && checked.ok)) {
        return checked as ConsultResult;
      }
      const envl = await maybeLlmConsult({
        tool,
        env: opts.env,
        input: checked.input,
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

    const { payment, backfilled } = withDiscoveryBackfill(opts.payment, pr);
    const verified = await facilitatorVerify({
      env: opts.env,
      payment,
      requirements: pr.accepts[0]!,
      fetchImpl: opts.fetchImpl,
    });
    if (!verified.ok) {
      return {
        status: 402,
        headers: { "PAYMENT-REQUIRED": encodePaymentRequired(pr) },
        body: {
          ...pr,
          facilitator_error: verified.reason,
          note:
            verified.reason === "FACILITATOR_AUTH_REQUIRED"
              ? "CDP facilitator verify/settle needs CDP_API_KEY_ID + CDP_API_KEY_SECRET on the seller host (not a wallet key)."
              : "Payment did not verify/settle. Do not retry blindly; inspect facilitator_error.",
        },
      };
    }

    const checked = validatePaidInput({ tool, env: opts.env, priceUsd, input: opts.input });
    if (!("ok" in checked && checked.ok)) {
      return checked as ConsultResult;
    }

    const settled = await facilitatorSettle({
      env: opts.env,
      payment,
      requirements: pr.accepts[0]!,
      fetchImpl: opts.fetchImpl,
    });
    const bazaarIndexing = preferIndexing(settled.bazaarIndexing, verified.bazaarIndexing);
    console.log(
      bazaarIndexingLogLine({
        service: "x402orcle",
        resourceUrl: pr.resource.url,
        transaction: settled.transaction,
        payer: settled.payer || verified.payer,
        backfilled,
        indexing: bazaarIndexing,
      }),
    );
    if (!settled.ok) {
      return {
        status: 402,
        headers: { "PAYMENT-REQUIRED": encodePaymentRequired(pr) },
        body: {
          ...pr,
          facilitator_error: settled.reason,
          note: "Payment verified but settlement failed. Do not retry blindly; inspect facilitator_error.",
        },
      };
    }

    const envl = await maybeLlmConsult({
      tool,
      env: opts.env,
      input: checked.input,
      receipt: {
        tool: tool.name,
        priceUsd,
        network: opts.env.network,
        payTo: opts.env.payTo,
        mode: "live",
        settlementId: settled.transaction || randomUUID(),
        transaction: settled.transaction,
        payer: settled.payer || verified.payer,
        paidAt: new Date().toISOString(),
        bazaarIndexing,
        discoveryBackfilled: backfilled,
      },
    });
    return { status: 200, body: envl };
  }

  const gate = gatePaidTool({
    toolName: tool.name,
    priceUsd,
    maxPriceUsd: opts.env.maxPriceUsd,
    userText: JSON.stringify(opts.input),
  });
  if (!gate.ok) {
    return { status: 400, body: { code: gate.code, message: gate.message } };
  }
  return { status: 200, body: { ok: true } };
}
