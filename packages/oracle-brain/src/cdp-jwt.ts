export type CdpAlg = "EdDSA" | "ES256";

function b64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

export function parseCdpPrivateKey(apiKeySecret: string): { key: unknown; alg: CdpAlg } {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = typeof eval !== "undefined" ? eval("require") : null;
  const nodeCrypto = req ? req("node:crypto") : null;
  if (!nodeCrypto) throw new Error("CDP JWT generation is server-only (node:crypto unavailable)");
  const secret = apiKeySecret.trim().replace(/^["']|["']$/g, "");
  const pem = secret.includes("BEGIN") && secret.includes("\\n") ? secret.replace(/\\n/g, "\n") : secret;
  if (pem.includes("BEGIN")) {
    return { key: nodeCrypto.createPrivateKey(pem), alg: "ES256" };
  }
  const raw = Buffer.from(secret, "base64");
  if (raw.length !== 64) {
    throw new Error(`CDP Ed25519 secret must decode to 64 bytes, got ${raw.length}`);
  }
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), raw.subarray(0, 32)]);
  return { key: nodeCrypto.createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }), alg: "EdDSA" };
}

export function generateCdpJwt(opts: {
  apiKeyId: string;
  apiKeySecret: string;
  method: string;
  url: string;
  expiresIn?: number;
}): string {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = typeof eval !== "undefined" ? eval("require") : null;
  const nodeCrypto = req ? req("node:crypto") : null;
  if (!nodeCrypto) throw new Error("CDP JWT generation is server-only (node:crypto unavailable)");
  const { key, alg } = parseCdpPrivateKey(opts.apiKeySecret);
  const target = new URL(opts.url);
  const path = `${target.pathname}${target.search}`;
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg,
    typ: "JWT",
    kid: opts.apiKeyId,
    nonce: nodeCrypto.randomBytes(16).toString("hex"),
  };
  const payload = {
    sub: opts.apiKeyId,
    iss: "cdp",
    aud: ["cdp_service"],
    nbf: now,
    exp: now + (opts.expiresIn ?? 120),
    uri: `${opts.method.toUpperCase()} ${target.host}${path}`,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature =
    alg === "EdDSA"
      ? nodeCrypto.sign(null, Buffer.from(signingInput), key)
      : nodeCrypto.sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

export function cdpAuthHeaders(opts: {
  apiKeyId?: string;
  apiKeySecret?: string;
  method: string;
  url: string;
}): Record<string, string> {
  const apiKeyId = opts.apiKeyId;
  const apiKeySecret = opts.apiKeySecret;
  if (!apiKeyId || !apiKeySecret) return {};
  if (!/cdp\.coinbase\.com$/i.test(new URL(opts.url).hostname)) return {};
  return {
    Authorization: `Bearer ${generateCdpJwt({ ...opts, apiKeyId, apiKeySecret })}`,
    Accept: "application/json",
  };
}
