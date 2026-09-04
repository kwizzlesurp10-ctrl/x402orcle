import { describe, expect, it } from "vitest";
import {
  loadEnv,
  gatePaidTool,
  fallbackConsult,
  requireTool,
  buildPaymentRequired,
  encodePaymentRequired,
  wellKnownX402,
  agentCard,
  llmsTxt,
  openApi,
  clampPrice,
  PAID_TOOLS,
  usdToAtomic,
} from "../src/index.js";

const env = loadEnv({
  X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
  X402_NETWORK: "eip155:8453",
  DEMO_MODE: "true",
  PUBLIC_BASE_URL: "http://127.0.0.1:4021",
  MAX_PRICE_USD: "25",
});

describe("env", () => {
  it("rejects private-key shaped payTo", () => {
    expect(() =>
      loadEnv({
        X402_PAY_TO: "0x" + "ab".repeat(32),
        DEMO_MODE: "true",
      }),
    ).toThrow(/private key/i);
  });

  it("accepts address and flags seller leak", () => {
    const e = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      EVM_PRIVATE_KEY: "0x" + "11".repeat(32),
      DEMO_MODE: "true",
    });
    expect(e.sellerLeakWarning).toBe(true);
    expect(e.payTo).toHaveLength(42);
  });
});

describe("policy", () => {
  it("caps price", () => {
    const r = gatePaidTool({ toolName: "complete_oracle_task", priceUsd: 40, maxPriceUsd: 25 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MAX_PRICE");
  });

  it("strips key material", () => {
    const r = gatePaidTool({
      toolName: "oracle_ask",
      priceUsd: 0.1,
      maxPriceUsd: 25,
      userText: "here is 0x" + "ab".repeat(32),
    });
    expect(r.ok).toBe(false);
  });
});

describe("402 challenge", () => {
  it("includes bazaar method, schema, and public url", () => {
    const tool = requireTool("oracle_ask");
    const pr = buildPaymentRequired({ env, tool, priceUsd: clampPrice(tool, undefined, 25) });
    expect(pr.x402Version).toBe(2);
    const input = pr.extensions.bazaar.info.input as { method?: string; bodyType?: string };
    expect(input.method).toBe("POST");
    expect(input.bodyType).toBe("json");
    expect(pr.extensions.bazaar.schema?.$schema).toMatch(/json-schema/);
    expect(pr.resource.url).toBe("http://127.0.0.1:4021/api/consult/oracle_ask");
    expect(pr.resource.serviceName.length).toBeLessThanOrEqual(32);
    expect(pr.resource.description.length).toBeLessThanOrEqual(500);
    expect(pr.accepts[0]?.amount).toBe(usdToAtomic(0.1));
    const b64 = encodePaymentRequired(pr);
    expect(JSON.parse(Buffer.from(b64, "base64").toString("utf8")).error).toBe("PAYMENT_REQUIRED");
  });
});

describe("consult envelope", () => {
  it("never asks for keys and mentions settlement ranking", () => {
    const tool = requireTool("oracle_ask");
    const envl = fallbackConsult({
      tool,
      env,
      input: { question: "Why no bazaar rank after many 402s?" },
    });
    expect(envl.verdict).toMatch(/settlement/i);
    expect(envl.implementation_prompt).toMatch(/SYSTEM:/);
    expect(envl.human.toLowerCase()).not.toMatch(/paste your private key/);
    expect(envl.citations.length).toBeGreaterThan(0);
  });
});

describe("discovery surfaces", () => {
  it("agent card has a2a-x402 and payTo", () => {
    const card = agentCard(env);
    expect(card.capabilities.extensions[0]?.uri).toContain("a2a-x402");
    expect(card.payments.rails[0]?.payTo).toBe(env.payTo);
    expect(card.funding.payTo).toBe(env.payTo);
  });

  it("llms.txt and openapi advertise payTo + x-payment-info", () => {
    const txt = llmsTxt(env);
    expect(txt).toContain(env.payTo);
    expect(txt).toContain("oracle_ask");
    const spec = openApi(env) as { paths: Record<string, { post?: { "x-payment-info"?: unknown }; get?: unknown }> };
    expect(spec.paths["/api/consult/oracle_ask"]?.post?.["x-payment-info"]).toBeTruthy();
    expect(spec.paths["/api/consult/oracle_ask"]?.get).toBeTruthy();
  });

  it("well-known x402 lists every paid tool", () => {
    const x = wellKnownX402(env);
    expect(x.payTo).toBe(env.payTo);
    expect(x.resources.length).toBe(PAID_TOOLS.length);
  });
});
