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
  jsonLd,
  llmsFullTxt,
  clampPrice,
  PAID_TOOLS,
  usdToAtomic,
  landingConsultCopy,
  landingHtml,
  generateCdpJwt,
  cdpAuthHeaders,
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

  it("refuses demo mode on https unless DEMO_ALLOW_PUBLIC", () => {
    const live = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      DEMO_MODE: "true",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
    });
    expect(live.demoMode).toBe(false);
    const allowed = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      DEMO_MODE: "true",
      DEMO_ALLOW_PUBLIC: "true",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
    });
    expect(allowed.demoMode).toBe(true);
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
    expect(pr.accepts[0]?.extra).toEqual({ name: "USD Coin", version: "2" });
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
  it("agent card has a2a-x402, /a2a url, and apiKey payment scheme", () => {
    const card = agentCard(env);
    expect(card.capabilities.extensions[0]?.uri).toContain("a2a-x402");
    expect(card.payments.rails[0]?.payTo).toBe(env.payTo);
    expect(card.funding.payTo).toBe(env.payTo);
    expect(card.url).toContain("/a2a");
    expect(card.defaultInputModes?.length).toBeGreaterThan(0);
    expect(card.supportedInterfaces?.[0]?.protocolBinding).toBe("JSONRPC");
    expect(card.securitySchemes?.x402Payment?.type).toBe("apiKey");
  });

  it("agent card skills carry machine-readable x402 terms and string examples", () => {
    const card = agentCard(env);
    expect(card.capabilities.extensions[0]?.uri).toBe(
      "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2",
    );
    expect(card.supportedInterfaces).toHaveLength(1);
    expect(card.supportedInterfaces[0]?.protocolVersion).toBe("0.3");
    expect(card.links.x402).toContain("/.well-known/x402");
    expect(card.links.a2a).toContain("/a2a");
    for (const s of card.skills) {
      expect(s.tags.length).toBeGreaterThan(0);
      expect(s.examples.every((e) => typeof e === "string")).toBe(true);
      expect(s.inputModes.length).toBeGreaterThan(0);
      expect(s.outputModes.length).toBeGreaterThan(0);
      expect(s.x402.network).toBe(env.network);
      expect(s.x402.assetSymbol).toBe("USDC");
      expect(s.x402.payTo).toBe(env.payTo);
      expect(s.x402.endpoint.url).toContain(s.id === "oracle_health" ? "/api/health" : "/api/");
      if (s.x402.paid) {
        expect(Number(s.x402.amount)).toBeGreaterThan(0);
        expect(s.x402.scheme).toBe("exact");
      }
    }
  });

  it("llms.txt and openapi advertise payTo + x-payment-info", () => {
    const txt = llmsTxt(env);
    expect(txt).toContain(env.payTo);
    expect(txt).toContain("oracle_ask");
    const spec = openApi(env) as { paths: Record<string, { post?: { "x-payment-info"?: unknown }; get?: unknown }> };
    expect(spec.paths["/api/consult/oracle_ask"]?.post?.["x-payment-info"]).toBeTruthy();
    const pay = spec.paths["/api/consult/oracle_ask"]?.post?.["x-payment-info"] as {
      protocols?: unknown[];
      price?: { amount?: string };
    };
    expect(pay.protocols).toEqual([{ x402: {} }]);
    expect(pay.price?.amount).toBe("0.100000");
    expect(spec.paths["/api/consult/oracle_ask"]?.get).toBeTruthy();
  });

  it("well-known x402 lists every paid tool", () => {
    const x = wellKnownX402(env);
    expect(x.payTo).toBe(env.payTo);
    expect(x.resources.length).toBe(PAID_TOOLS.length);
  });

  it("jsonLd returns multi-entity Schema.org graph (SoftwareApplication, WebAPI, Service, Dataset, Organization)", () => {
    const ld = jsonLd(env);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(Array.isArray(ld["@graph"])).toBe(true);
    const types = ld["@graph"].map((node: { "@type": string }) => node["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("WebAPI");
    expect(types).toContain("Service");
    expect(types).toContain("Dataset");
  });

  it("llmsFullTxt includes full schemas and payment specs", () => {
    const full = llmsFullTxt(env);
    expect(full).toContain("Full Technical Reference");
    expect(full).toContain("Wisdom Envelope Format");
    expect(full).toContain("oracle_ask");
  });

  it("publishes contact email in OpenAPI info for Poncho verification (R1)", () => {
    const spec = openApi(env) as {
      info: {
        contact?: { email?: string };
      };
    };
    expect(spec.info.contact).toBeDefined();
    expect(spec.info.contact?.email).toBe("kwizzlesurp10@gmail.com");
  });

  it("declares security: [] for free endpoints and x402Payment for paid endpoints (R2)", () => {
    const spec = openApi(env) as {
      paths: Record<
        string,
        {
          get?: { security?: unknown[] };
          post?: { security?: unknown[] };
        }
      >;
    };
    expect(spec.paths["/api/health"]?.get?.security).toEqual([]);
    expect(spec.paths["/api/pricing"]?.get?.security).toEqual([]);
    expect(spec.paths["/.well-known/funding.json"]?.get?.security).toEqual([]);
    expect(spec.paths["/api/consult/oracle_ask"]?.post?.security).toEqual([{ x402Payment: [] }]);
  });

  it("defines FundingResponse schema and maps /.well-known/funding.json 200 response (R3)", () => {
    const spec = openApi(env) as {
      paths: Record<
        string,
        {
          get?: {
            responses?: Record<
              string,
              {
                content?: Record<string, { schema?: { $ref?: string } }>;
              }
            >;
          };
        }
      >;
      components: {
        schemas: Record<string, { type?: string; required?: string[]; properties?: Record<string, unknown> }>;
      };
    };
    expect(
      spec.paths["/.well-known/funding.json"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
    ).toBe("#/components/schemas/FundingResponse");
    const schema = spec.components.schemas.FundingResponse;
    expect(schema).toBeDefined();
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "schema_version",
        "network",
        "chainId",
        "asset",
        "assetSymbol",
        "payTo",
        "machineCashier",
        "discovery",
        "legal",
      ]),
    );
  });
});

describe("landing consult copy", () => {
  it("demo host advertises mint-payment", () => {
    const copy = landingConsultCopy(env);
    expect(copy.commands).toContain("/v1/demo/mint-payment");
    expect(landingHtml(env)).toContain("/v1/demo/mint-payment");
  });

  it("https public host never advertises demo mint", () => {
    const live = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      DEMO_MODE: "true",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
    });
    const copy = landingConsultCopy(live);
    expect(copy.commands).not.toContain("/v1/demo/mint-payment");
    expect(copy.caption.toLowerCase()).not.toContain("demo mint");
    expect(copy.commands).toContain("PAYMENT-SIGNATURE");
    const html = landingHtml(live);
    expect(html).not.toContain("/v1/demo/mint-payment");
    expect(html).toContain("HTTP 402");
  });
});

describe("cdp jwt", () => {
  const apiKeyId = "00000000-0000-0000-0000-000000000001";
  const apiKeySecret = Buffer.concat([Buffer.alloc(32, 1), Buffer.alloc(32, 2)]).toString("base64");

  it("signs EdDSA jwt bound to method and path", () => {
    const token = generateCdpJwt({
      apiKeyId,
      apiKeySecret,
      method: "POST",
      url: "https://api.cdp.coinbase.com/platform/v2/x402/verify",
    });
    const [h, p, s] = token.split(".");
    const header = JSON.parse(Buffer.from(h!, "base64url").toString("utf8")) as { alg?: string; kid?: string };
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString("utf8")) as { iss?: string; uri?: string };
    expect(header.alg).toBe("EdDSA");
    expect(header.kid).toBe(apiKeyId);
    expect(payload.iss).toBe("cdp");
    expect(payload.uri).toBe("POST api.cdp.coinbase.com/platform/v2/x402/verify");
    expect(s).toBeTruthy();
  });

  it("omits Authorization on non-CDP facilitators", () => {
    expect(
      cdpAuthHeaders({
        apiKeyId,
        apiKeySecret,
        method: "POST",
        url: "https://facilitator.payai.network/verify",
      }),
    ).toEqual({});
  });
});

describe("live facilitator consult", () => {
  it("401 verify surfaces FACILITATOR_AUTH_REQUIRED without serving wisdom", async () => {
    const live = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      DEMO_MODE: "false",
    });
    const { handleConsult } = await import("../src/index.js");
    const fetchImpl = (async () =>
      new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch;
    const res = await handleConsult({
      env: live,
      toolName: "oracle_ask",
      input: { question: "rank?" },
      payment: { x402Version: 2, accepted: { scheme: "exact", network: live.network, payTo: live.payTo } },
      transport: "http",
      fetchImpl,
    });
    expect(res.status).toBe(402);
    expect((res.body as { facilitator_error?: string }).facilitator_error).toBe(
      "FACILITATOR_AUTH_REQUIRED",
    );
  });

  it("sends CDP Bearer JWT on verify and settle when keys are set", async () => {
    const apiKeySecret = Buffer.concat([Buffer.alloc(32, 1), Buffer.alloc(32, 2)]).toString("base64");
    const live = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      DEMO_MODE: "false",
      CDP_API_KEY_ID: "00000000-0000-0000-0000-000000000001",
      CDP_API_KEY_SECRET: apiKeySecret,
    });
    const auths: string[] = [];
    const { handleConsult } = await import("../src/index.js");
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      auths.push(`${String(url)} ${headers?.Authorization ? "bearer" : "none"}`);
      if (String(url).endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0xabc" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ success: true, payer: "0xabc", transaction: "0xcdp" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const res = await handleConsult({
      env: live,
      toolName: "oracle_ask",
      input: { question: "Why no rank without settlement?" },
      payment: { x402Version: 2 },
      transport: "http",
      fetchImpl,
    });
    expect(res.status).toBe(200);
    expect(auths.some((a) => a.includes("/verify") && a.endsWith("bearer"))).toBe(true);
    expect(auths.some((a) => a.includes("/settle") && a.endsWith("bearer"))).toBe(true);
  });

  it("401 on CDP then fallback facilitator settles", async () => {
    const live = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      DEMO_MODE: "false",
      X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
      X402_FACILITATOR_URL_FALLBACK: "https://facilitator.payai.network",
    });
    const { handleConsult } = await import("../src/index.js");
    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.includes("api.cdp.coinbase.com")) {
        return new Response("Unauthorized", { status: 401 });
      }
      if (u.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0xabc" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ success: true, payer: "0xabc", transaction: "0xfeed" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const res = await handleConsult({
      env: live,
      toolName: "oracle_ask",
      input: { question: "Why no rank without settlement?" },
      payment: { x402Version: 2 },
      transport: "http",
      fetchImpl,
    });
    expect(res.status).toBe(200);
    const body = res.body as { receipt?: { mode?: string; transaction?: string } };
    expect(body.receipt?.mode).toBe("live");
    expect(body.receipt?.transaction).toBe("0xfeed");
  });

  it("successful verify+settle returns live receipt", async () => {
    const live = loadEnv({
      X402_PAY_TO: "0xAB745e5F576667037696e78ba7dA28E193E4423D",
      PUBLIC_BASE_URL: "https://x402orcle.vercel.app",
      DEMO_MODE: "false",
    });
    const { handleConsult } = await import("../src/index.js");
    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true, payer: "0xabc" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ success: true, payer: "0xabc", transaction: "0xdead" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const res = await handleConsult({
      env: live,
      toolName: "oracle_ask",
      input: { question: "Why no rank without settlement?" },
      payment: { x402Version: 2 },
      transport: "http",
      fetchImpl,
    });
    expect(res.status).toBe(200);
    const body = res.body as { receipt?: { mode?: string; transaction?: string } };
    expect(body.receipt?.mode).toBe("live");
    expect(body.receipt?.transaction).toBe("0xdead");
  });
});
