import { randomBytes } from "node:crypto";

export function buildDemoPaymentPayload(opts: {
  accepts: {
    scheme: string;
    network: string;
    amount?: string;
    payTo: string;
  };
  payer?: string;
  resourceUrl?: string;
}) {
  const payer = opts.payer ?? "0xdemo000000000000000000000000000000000001";
  const accepted = structuredClone(opts.accepts);
  return {
    x402Version: 2,
    resource: opts.resourceUrl
      ? { url: opts.resourceUrl, description: "", mimeType: "application/json" }
      : undefined,
    accepted,
    payload: {
      signature: `demo-sig-${randomBytes(8).toString("hex")}`,
      authorization: {
        from: payer,
        to: accepted.payTo,
        value: accepted.amount,
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        nonce: `0x${randomBytes(32).toString("hex")}`,
      },
    },
  };
}

export function demoPayerFromPayload(payment: unknown): string {
  const p = payment as {
    payload?: { authorization?: { from?: string } };
    payer?: string;
  };
  return p.payload?.authorization?.from ?? p.payer ?? "0xunknown00000000000000000000000000000001";
}

export function demoVerify(payment: unknown, network: string, payTo: string): { ok: boolean; payer: string; reason?: string } {
  if (!payment || typeof payment !== "object") {
    return { ok: false, payer: "", reason: "missing_payload" };
  }
  const p = payment as {
    accepted?: { network?: string; payTo?: string; scheme?: string };
  };
  if (p.accepted?.scheme && p.accepted.scheme !== "exact") {
    return { ok: false, payer: "", reason: "scheme_mismatch" };
  }
  if (p.accepted?.network && p.accepted.network !== network) {
    return { ok: false, payer: "", reason: "network_mismatch" };
  }
  if (p.accepted?.payTo && p.accepted.payTo.toLowerCase() !== payTo.toLowerCase()) {
    return { ok: false, payer: "", reason: "payto_mismatch" };
  }
  return { ok: true, payer: demoPayerFromPayload(payment) };
}
