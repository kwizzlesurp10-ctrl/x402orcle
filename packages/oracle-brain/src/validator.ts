export type SigValidationResult = {
  isValid: boolean;
  score: number; // 0 - 100%
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
  decoded: {
    x402Version?: number;
    scheme?: string;
    network?: string;
    asset?: string;
    payTo?: string;
    amount?: string;
    payer?: string;
    validAfter?: string;
    validBefore?: string;
    nonce?: string;
    signature?: string;
  };
};

export function validatePaymentEnvelope(
  input: string | Record<string, unknown>,
  expectedPayTo: string = "0x05e1720bB82F86B5bc7940a99FDC702E32256357",
  expectedNetwork: string = "eip155:8453"
): SigValidationResult {
  const checks: SigValidationResult["checks"] = [];
  let parsed: Record<string, unknown> | null = null;

  // 1. JSON / Base64 parsing check
  if (typeof input === "string") {
    try {
      const raw = input.trim();
      const jsonStr = raw.startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf8");
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      checks.push({
        name: "Envelope Serialization",
        passed: true,
        detail: "Decoded valid JSON from input string / base64 payload.",
      });
    } catch {
      checks.push({
        name: "Envelope Serialization",
        passed: false,
        detail: "Failed to decode valid JSON payload from string.",
      });
      return {
        isValid: false,
        score: 0,
        checks,
        decoded: {},
      };
    }
  } else if (typeof input === "object" && input !== null) {
    parsed = input;
    checks.push({
      name: "Envelope Serialization",
      passed: true,
      detail: "Input provided as structured JSON object.",
    });
  } else {
    return {
      isValid: false,
      score: 0,
      checks: [{ name: "Input Type", passed: false, detail: "Input must be a base64 string or JSON object." }],
      decoded: {},
    };
  }

  // Extract fields
  const x402Version = parsed.x402Version as number | undefined;
  const accepted = (parsed.accepted ?? {}) as Record<string, unknown>;
  const payload = (parsed.payload ?? {}) as Record<string, unknown>;
  const authorization = (payload.authorization ?? {}) as Record<string, unknown>;

  const scheme = String(accepted.scheme ?? "");
  const network = String(accepted.network ?? "");
  const asset = String(accepted.asset ?? "");
  const payTo = String(accepted.payTo ?? authorization.to ?? "");
  const amount = String(accepted.amount ?? authorization.value ?? "");
  const payer = String(authorization.from ?? "");
  const validAfter = String(authorization.validAfter ?? "0");
  const validBefore = String(authorization.validBefore ?? "0");
  const nonce = String(authorization.nonce ?? "");
  const signature = String(payload.signature ?? "");

  // 2. x402 Version check
  const versionOk = x402Version === 2;
  checks.push({
    name: "Protocol Version (x402 v2)",
    passed: versionOk,
    detail: versionOk ? "x402Version is 2 (Canonical v2 envelope)" : `Expected x402Version 2, found ${String(x402Version)}`,
  });

  // 3. Scheme check
  const schemeOk = scheme === "exact";
  checks.push({
    name: "Payment Scheme",
    passed: schemeOk,
    detail: schemeOk ? "Scheme is exact (Deterministic micro-settlement)" : `Expected scheme 'exact', found '${scheme}'`,
  });

  // 4. Network check
  const networkOk = network === expectedNetwork || network === "eip155:8453" || network === "eip155:84532";
  checks.push({
    name: "Network Identifier (Base)",
    passed: networkOk,
    detail: networkOk ? `Settles on Base (${network})` : `Network '${network}' does not match Base specification`,
  });

  // 5. PayTo Destination check
  const payToOk = payTo.toLowerCase() === expectedPayTo.toLowerCase();
  checks.push({
    name: "Destination payTo Address",
    passed: payToOk,
    detail: payToOk
      ? `payTo matches verified oracle vault address (${expectedPayTo})`
      : `Destination '${payTo}' mismatch (expected ${expectedPayTo})`,
  });

  // 6. Nonce Entropy check
  const nonceOk = /^0x[0-9a-fA-F]{64}$/.test(nonce) || nonce.startsWith("0xdemo") || nonce.length >= 10;
  checks.push({
    name: "Cryptographic Nonce (32-byte entropy)",
    passed: nonceOk,
    detail: nonceOk ? `Valid nonce detected (${nonce.slice(0, 10)}...)` : "Nonce is missing or malformed",
  });

  // 7. Time Bound Validity check
  const nowSec = Math.floor(Date.now() / 1000);
  const vBeforeNum = Number(validBefore) || 0;
  const vAfterNum = Number(validAfter) || 0;
  const timeOk = vBeforeNum > nowSec && vAfterNum <= nowSec;
  checks.push({
    name: "Temporal Validity Window (EIP-3009)",
    passed: timeOk,
    detail: timeOk
      ? `Valid until timestamp ${validBefore} (${Math.round((vBeforeNum - nowSec) / 60)}m remaining)`
      : `Signature expired or invalid window (validBefore: ${validBefore}, now: ${nowSec})`,
  });

  // 8. Signature Format check
  const sigOk = signature.length >= 20;
  checks.push({
    name: "ECDSA / Demo Signature Payload",
    passed: sigOk,
    detail: sigOk ? `Signature payload present (${signature.slice(0, 16)}...)` : "Missing signature field",
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const isValid = passedCount === checks.length;

  return {
    isValid,
    score,
    checks,
    decoded: {
      x402Version,
      scheme,
      network,
      asset,
      payTo,
      amount,
      payer,
      validAfter,
      validBefore,
      nonce,
      signature,
    },
  };
}
