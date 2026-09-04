import { FREE_TOOLS, PAID_TOOLS, SERVICE, TOOLS, clampPrice, jsonSchemaFromExample } from "./catalog.js";
import { BASE_USDC, usdToAtomic, usdcForNetwork, type OracleEnv } from "./env.js";
import { ORACLE_CONNECT_HOWTO } from "./persona.js";
import { paidCatalogRequired } from "./challenge.js";

export function funding(env: OracleEnv) {
  return {
    schema_version: "1.0",
    network: env.network,
    chainId: env.network.includes("84532") ? 84532 : 8453,
    asset: usdcForNetwork(env.network),
    assetSymbol: "USDC",
    payTo: env.payTo,
    explorer: `https://basescan.org/address/${env.payTo}`,
    machineCashier: {
      protocol: "x402",
      challengeHeader: "PAYMENT-REQUIRED",
      paymentHeader: "PAYMENT-SIGNATURE",
      catalog: `${env.publicBaseUrl}/.well-known/x402`,
    },
    discovery: {
      agentCard: `${env.publicBaseUrl}/.well-known/agent-card.json`,
      agentsJson: `${env.publicBaseUrl}/.well-known/agents.json`,
      x402: `${env.publicBaseUrl}/.well-known/x402`,
      mcp: `${env.publicBaseUrl}/.well-known/mcp.json`,
      llmsTxt: `${env.publicBaseUrl}/llms.txt`,
      openapi: `${env.publicBaseUrl}/openapi.json`,
    },
    legal:
      "Payment for delivered consult artifacts or a voluntary tip. Not a token, not equity, not a raise.",
  };
}

export function wellKnownX402(env: OracleEnv) {
  const paid = paidCatalogRequired(env);
  return {
    version: 1,
    x402_version: 2,
    service: SERVICE.slug,
    base_url: env.publicBaseUrl,
    networks: [env.network],
    asset: usdcForNetwork(env.network),
    payTo: env.payTo,
    payment_header: "PAYMENT-SIGNATURE",
    challenge_header: "PAYMENT-REQUIRED",
    receipt_header: "PAYMENT-RESPONSE",
    funding: `${env.publicBaseUrl}/.well-known/funding.json`,
    mcp: {
      manifest: `${env.publicBaseUrl}/.well-known/mcp.json`,
      streamable_http: `${env.publicBaseUrl}/mcp`,
    },
    docs: `${env.publicBaseUrl}/llms.txt`,
    agent_card: `${env.publicBaseUrl}/.well-known/agent-card.json`,
    resources: paid.map((p) => p.resource.url),
    resource_details: TOOLS.map((t) => ({
      url: `${env.publicBaseUrl}${t.httpPath}`,
      method: t.httpMethod,
      price: t.tier === "free" ? "free" : `$${clampPrice(t, undefined, env.maxPriceUsd)}`,
      network: t.tier === "free" ? null : env.network,
      name: t.serviceName,
      what: t.description,
      params: t.inputExample,
    })),
    legal: funding(env).legal,
  };
}

export function mcpJson(env: OracleEnv) {
  return {
    name: SERVICE.name,
    version: SERVICE.version,
    transport: "streamable-http",
    url: `${env.publicBaseUrl}/mcp`,
    authentication: {
      type: "x402",
      pay_to: env.payTo,
      network: env.network,
    },
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      paid: t.tier === "paid",
      priceUsd: t.tier === "paid" ? clampPrice(t, undefined, env.maxPriceUsd) : 0,
    })),
  };
}

export function agentCard(env: OracleEnv) {
  const f = funding(env);
  return {
    protocolVersion: "1.0",
    name: SERVICE.name,
    description: SERVICE.thesis,
    url: env.publicBaseUrl,
    provider: { organization: "Local AI Integrations", url: env.publicBaseUrl },
    capabilities: {
      extensions: [
        {
          uri: "https://github.com/google-a2a/a2a-x402/v0.1",
          description: "x402 exact scheme on Base USDC",
          required: false,
          params: { network: env.network, asset: usdcForNetwork(env.network), payTo: env.payTo },
        },
      ],
    },
    payments: {
      rails: [
        {
          id: "x402",
          protocol: "x402",
          network: env.network,
          asset: usdcForNetwork(env.network),
          assetSymbol: "USDC",
          payTo: env.payTo,
          facilitator: env.facilitatorUrl,
          challengeHeader: "PAYMENT-REQUIRED",
          catalog: `${env.publicBaseUrl}/.well-known/x402`,
        },
      ],
    },
    funding: f,
    skills: PAID_TOOLS.map((t) => ({
      id: t.name,
      name: t.serviceName,
      description: t.description,
      tags: t.tags,
      priceUsd: clampPrice(t, undefined, env.maxPriceUsd),
    })),
  };
}

export function agentsJson(env: OracleEnv) {
  return {
    agents: [
      {
        id: SERVICE.slug,
        name: SERVICE.name,
        url: env.publicBaseUrl,
        mcp: `${env.publicBaseUrl}/mcp`,
      },
    ],
    settlement_address: env.payTo,
    network: env.network,
    asset: usdcForNetwork(env.network),
  };
}

export function llmsTxt(env: OracleEnv): string {
  return [
    `# ${SERVICE.name}`,
    "",
    SERVICE.thesis,
    "",
    "## Connect (free)",
    ORACLE_CONNECT_HOWTO,
    "",
    "## Discover",
    `- ${env.publicBaseUrl}/.well-known/x402`,
    `- ${env.publicBaseUrl}/.well-known/mcp.json`,
    `- ${env.publicBaseUrl}/.well-known/agent-card.json`,
    `- ${env.publicBaseUrl}/.well-known/agents.json`,
    `- ${env.publicBaseUrl}/.well-known/funding.json`,
    `- ${env.publicBaseUrl}/llms.txt`,
    `- ${env.publicBaseUrl}/agents.txt`,
    `- ${env.publicBaseUrl}/openapi.json`,
    `- MCP streamable HTTP ${env.publicBaseUrl}/mcp`,
    "",
    "## Fund (USDC on Base)",
    `payTo: ${env.payTo}`,
    `asset: ${usdcForNetwork(env.network)}`,
    `network: ${env.network}`,
    funding(env).legal,
    "",
    "## Free tools",
    ...FREE_TOOLS.map((t) => `- ${t.name} ${t.httpPath}`),
    "",
    "## Paid tools (HTTP 402 + MCP)",
    ...PAID_TOOLS.map(
      (t) =>
        `- ${t.name} $${clampPrice(t, undefined, env.maxPriceUsd)} ${t.httpMethod} ${t.httpPath}`,
    ),
    "",
    "Ranking requires a mainnet settlement. 402 probes do not catalog.",
    "",
  ].join("\n");
}

export function agentsTxt(env: OracleEnv): string {
  return [
    `# agents.txt — ${SERVICE.slug}`,
    `User-agent: *`,
    `Allow: /.well-known/`,
    `Allow: /llms.txt`,
    `Allow: /api/health`,
    `Allow: /api/pricing`,
    `Pay-To: ${env.payTo}`,
    `Network: ${env.network}`,
    `MCP: ${env.publicBaseUrl}/mcp`,
    `Catalog: ${env.publicBaseUrl}/.well-known/x402`,
    "",
  ].join("\n");
}

export function openApi(env: OracleEnv) {
  const paths: Record<string, unknown> = {};
  for (const t of TOOLS) {
    const paid = t.tier === "paid";
    const priceUsd = clampPrice(t, undefined, env.maxPriceUsd);
    const paymentInfo = paid
      ? {
          price: {
            mode: "fixed",
            currency: "USD",
            amount: priceUsd.toFixed(6),
          },
          protocols: [{ x402: {} }],
          network: env.network,
          payTo: env.payTo,
          asset: usdcForNetwork(env.network),
          atomicAmount: usdToAtomic(priceUsd),
        }
      : undefined;
    const op: Record<string, unknown> = {
      summary: t.description,
      operationId: t.name,
      tags: t.tags,
      ...(paid ? { "x-payment-info": paymentInfo } : {}),
      responses: {
        ...(paid
          ? {
              "402": {
                description: "Payment Required",
                headers: {
                  "PAYMENT-REQUIRED": { schema: { type: "string", format: "byte" } },
                },
              },
            }
          : {}),
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: { type: "object" },
              example: t.outputExample,
            },
          },
        },
      },
    };
    if (t.httpMethod === "POST") {
      op.requestBody = {
        required: paid,
        content: {
          "application/json": {
            schema: jsonSchemaFromExample(t.inputExample),
            example: t.inputExample,
          },
        },
      };
    }
    paths[t.httpPath] = { [t.httpMethod.toLowerCase()]: op };
    if (paid && t.httpMethod === "POST") {
      const existing = (paths[t.httpPath] as Record<string, unknown>) || {};
      existing.get = {
        summary: `Crawler 402 for ${t.name}`,
        operationId: `${t.name}_crawler_402`,
        "x-payment-info": paymentInfo,
        responses: {
          "402": (op.responses as Record<string, unknown>)["402"],
          "200": { description: "Paid GET not used; POST after payment" },
        },
      };
      paths[t.httpPath] = existing;
    }
  }
  paths["/.well-known/funding.json"] = {
    get: { summary: "Canonical payTo", responses: { "200": { description: "funding" } } },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: SERVICE.name,
      version: SERVICE.version,
      description: SERVICE.thesis,
      "x-guidance":
        "Free GET /api/health and /api/pricing. Paid consults: POST /api/consult/oracle_ask with JSON {question}. Unpaid probes return HTTP 402 and PAYMENT-REQUIRED (x402 v2, Base USDC). After payment, retry with PAYMENT-SIGNATURE. MCP streamable HTTP at /mcp. No private keys.",
    },
    servers: [{ url: env.publicBaseUrl }],
    paths,
  };
}

export function jsonLd(env: OracleEnv) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SERVICE.name,
    applicationCategory: "DeveloperApplication",
    description: SERVICE.thesis,
    url: env.publicBaseUrl,
    offers: PAID_TOOLS.map((t) => ({
      "@type": "Offer",
      name: t.serviceName,
      price: String(clampPrice(t, undefined, env.maxPriceUsd)),
      priceCurrency: "USD",
    })),
  };
}

export { BASE_USDC };
