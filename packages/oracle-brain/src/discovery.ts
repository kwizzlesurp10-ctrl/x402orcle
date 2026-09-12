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
      llmsFullTxt: `${env.publicBaseUrl}/llms-full.txt`,
      agentsTxt: `${env.publicBaseUrl}/agents.txt`,
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
    name: SERVICE.name,
    base_url: env.publicBaseUrl,
    networks: [env.network],
    asset: usdcForNetwork(env.network),
    asset_symbol: "USDC",
    payTo: env.payTo,
    facilitator: env.facilitatorUrl,
    payment_header: "PAYMENT-SIGNATURE",
    challenge_header: "PAYMENT-REQUIRED",
    receipt_header: "PAYMENT-RESPONSE",
    discovery: {
      agent_card: `${env.publicBaseUrl}/.well-known/agent-card.json`,
      agents_json: `${env.publicBaseUrl}/.well-known/agents.json`,
      mcp_manifest: `${env.publicBaseUrl}/.well-known/mcp.json`,
      funding: `${env.publicBaseUrl}/.well-known/funding.json`,
      openapi: `${env.publicBaseUrl}/openapi.json`,
      llms_txt: `${env.publicBaseUrl}/llms.txt`,
      llms_full_txt: `${env.publicBaseUrl}/llms-full.txt`,
      agents_txt: `${env.publicBaseUrl}/agents.txt`,
    },
    mcp: {
      manifest: `${env.publicBaseUrl}/.well-known/mcp.json`,
      streamable_http: `${env.publicBaseUrl}/mcp`,
    },
    docs: `${env.publicBaseUrl}/llms.txt`,
    agent_card: `${env.publicBaseUrl}/.well-known/agent-card.json`,
    resources: paid.map((p) => p.resource.url),
    resource_details: TOOLS.map((t) => ({
      url: `${env.publicBaseUrl}${t.httpPath}`,
      mcp_url: `mcp://tool/${t.name}`,
      method: t.httpMethod,
      tier: t.tier,
      price: t.tier === "free" ? "free" : `$${clampPrice(t, undefined, env.maxPriceUsd)}`,
      price_usd: t.tier === "free" ? 0 : clampPrice(t, undefined, env.maxPriceUsd),
      atomic_amount: t.tier === "free" ? "0" : usdToAtomic(clampPrice(t, undefined, env.maxPriceUsd)),
      network: t.tier === "free" ? null : env.network,
      name: t.serviceName,
      what: t.description,
      tags: t.tags,
      inputSchema: jsonSchemaFromExample(t.inputExample),
      outputSchema: jsonSchemaFromExample(t.outputExample),
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
      inputSchema: jsonSchemaFromExample(t.inputExample),
    })),
  };
}

export function agentCard(env: OracleEnv) {
  const f = funding(env);
  return {
    protocolVersion: "1.0",
    id: SERVICE.slug,
    name: SERVICE.name,
    version: SERVICE.version,
    description: SERVICE.thesis,
    url: env.publicBaseUrl,
    documentationUrl: `${env.publicBaseUrl}/llms.txt`,
    provider: {
      organization: "Local AI Integrations",
      url: env.publicBaseUrl,
    },
    transports: [
      {
        type: "http",
        url: `${env.publicBaseUrl}/api/consult`,
        methods: ["GET", "POST"],
      },
      {
        type: "mcp-streamable-http",
        url: `${env.publicBaseUrl}/mcp`,
      },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [
        {
          uri: "https://github.com/google-a2a/a2a-x402/v0.1",
          description: "x402 exact scheme on Base USDC",
          required: false,
          params: {
            network: env.network,
            asset: usdcForNetwork(env.network),
            payTo: env.payTo,
            facilitator: env.facilitatorUrl,
          },
        },
      ],
    },
    securitySchemes: {
      x402: {
        type: "x402",
        scheme: "exact",
        header: "PAYMENT-SIGNATURE",
        challengeHeader: "PAYMENT-REQUIRED",
        network: env.network,
        asset: usdcForNetwork(env.network),
        payTo: env.payTo,
      },
    },
    payments: {
      rails: [
        {
          id: "x402",
          protocol: "x402",
          version: 2,
          network: env.network,
          asset: usdcForNetwork(env.network),
          assetSymbol: "USDC",
          payTo: env.payTo,
          facilitator: env.facilitatorUrl,
          challengeHeader: "PAYMENT-REQUIRED",
          paymentHeader: "PAYMENT-SIGNATURE",
          catalog: `${env.publicBaseUrl}/.well-known/x402`,
        },
      ],
    },
    funding: f,
    skills: TOOLS.map((t) => ({
      id: t.name,
      name: t.serviceName,
      description: t.description,
      tier: t.tier,
      tags: t.tags,
      pricing: {
        mode: t.tier === "free" ? "free" : "fixed",
        currency: "USD",
        priceUsd: t.tier === "free" ? 0 : clampPrice(t, undefined, env.maxPriceUsd),
        atomicAmount: t.tier === "free" ? "0" : usdToAtomic(clampPrice(t, undefined, env.maxPriceUsd)),
        network: env.network,
        payTo: env.payTo,
      },
      inputSchema: jsonSchemaFromExample(t.inputExample),
      outputSchema: jsonSchemaFromExample(t.outputExample),
      examples: [
        {
          input: t.inputExample,
          output: t.outputExample,
        },
      ],
      endpoints: [
        {
          transport: "http",
          method: t.httpMethod,
          url: `${env.publicBaseUrl}${t.httpPath}`,
        },
        {
          transport: "mcp",
          toolName: t.name,
          url: `${env.publicBaseUrl}/mcp`,
        },
      ],
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
    `> ${SERVICE.thesis} Autonomous agent-to-agent (A2A) consultation and verification protocol powered by HTTP 402 micro-settlements on Base USDC.`,
    "",
    "## Quickstart & Connect (Free)",
    ORACLE_CONNECT_HOWTO,
    "",
    "## Machine Discovery Manifests",
    `- [x402 Catalog](${env.publicBaseUrl}/.well-known/x402): Machine-readable x402 v2 payment catalog and resource specs`,
    `- [Agent Card](${env.publicBaseUrl}/.well-known/agent-card.json): Google A2A protocol agent-card manifest`,
    `- [MCP Server Manifest](${env.publicBaseUrl}/.well-known/mcp.json): Model Context Protocol server definition`,
    `- [MCP Streamable Endpoint](${env.publicBaseUrl}/mcp): Live MCP streamable-http RPC gateway`,
    `- [Funding Manifest](${env.publicBaseUrl}/.well-known/funding.json): Canonical payTo receiver address and Base USDC settlement configuration`,
    `- [OpenAPI 3.1 Spec](${env.publicBaseUrl}/openapi.json): Complete REST OpenAPI 3.1 schema with x-payment-info extensions`,
    `- [LLMs Full Documentation](${env.publicBaseUrl}/llms-full.txt): Comprehensive schemas, envelope formats, and TypeScript types`,
    `- [Agents Permissions](${env.publicBaseUrl}/agents.txt): Agent bot crawling permissions and service endpoints`,
    "",
    "## Free Tools (No Payment Required)",
    ...FREE_TOOLS.map((t) => `- [${t.serviceName}](${env.publicBaseUrl}${t.httpPath}): ${t.description}`),
    "",
    "## Paid Tools (HTTP 402 & MCP with PAYMENT-SIGNATURE)",
    ...PAID_TOOLS.map(
      (t) =>
        `- [${t.serviceName} ($${clampPrice(t, undefined, env.maxPriceUsd)})](${env.publicBaseUrl}${t.httpPath}): ${t.description} (Method: ${t.httpMethod})`,
    ),
    "",
    "## Settlement Rules & Guidelines",
    `- Network: ${env.network} (Base Mainnet)`,
    `- Asset: ${usdcForNetwork(env.network)} (USDC)`,
    `- PayTo Address: ${env.payTo}`,
    "- Ranking & Cataloging: Triggered by verified onchain mainnet settlements. Unpaid 402 challenge probes do not index.",
    "",
  ].join("\n");
}

export function llmsFullTxt(env: OracleEnv): string {
  return [
    `# ${SERVICE.name} — Full Technical Reference`,
    "",
    `> ${SERVICE.thesis}`,
    "",
    "## Architecture Overview",
    "x402 Oracle is a seller-only autonomous oracle providing on-chain state verification, smart contract consultation, and MCP auditing.",
    "Requests without payment receive HTTP 402 Payment Required challenges containing Base USDC payment parameters.",
    "Clients sign payment authorizations via EIP-712 and attach the PAYMENT-SIGNATURE header to complete the consultation.",
    "",
    "## Machine Discovery Endpoints",
    `- Catalog: ${env.publicBaseUrl}/.well-known/x402`,
    `- Agent Card: ${env.publicBaseUrl}/.well-known/agent-card.json`,
    `- MCP: ${env.publicBaseUrl}/.well-known/mcp.json`,
    `- Funding: ${env.publicBaseUrl}/.well-known/funding.json`,
    `- OpenAPI: ${env.publicBaseUrl}/openapi.json`,
    `- LLMs Minimal: ${env.publicBaseUrl}/llms.txt`,
    `- Agents: ${env.publicBaseUrl}/agents.txt`,
    `- MCP RPC Endpoint: ${env.publicBaseUrl}/mcp`,
    "",
    "## Payment Parameters",
    `- Facilitator: ${env.facilitatorUrl}`,
    `- Network: ${env.network} (Base Mainnet / eip155:8453)`,
    `- Asset: ${usdcForNetwork(env.network)} (USDC on Base)`,
    `- PayTo: ${env.payTo}`,
    `- Challenge Header: PAYMENT-REQUIRED (Base64 JSON)`,
    `- Authorization Header: PAYMENT-SIGNATURE`,
    `- Receipt Header: PAYMENT-RESPONSE`,
    "",
    "## Tool Catalog & Schemas",
    ...TOOLS.map((t) => [
      `### ${t.serviceName} (\`${t.name}\`)`,
      `- Tier: ${t.tier}`,
      `- Price: ${t.tier === "free" ? "Free" : `$${clampPrice(t, undefined, env.maxPriceUsd)} USDC`}`,
      `- HTTP: ${t.httpMethod} ${t.httpPath}`,
      `- Description: ${t.description}`,
      `- Input Example: \`${JSON.stringify(t.inputExample)}\``,
      `- Output Example: \`${JSON.stringify(t.outputExample)}\``,
      ""
    ].join("\n")),
    "",
    "## Wisdom Envelope Format",
    "Paid consultation endpoints return a structured Wisdom Envelope object:",
    "```json",
    JSON.stringify({
      verdict: "APPROVE | WARN | REJECT",
      wisdom: "In-depth analysis and guidance",
      implementation_prompt: "Executable prompt for code generation",
      risk: "LOW | MEDIUM | HIGH",
      citations: ["https://docs.cdp.coinbase.com/x402"],
      receipt: {
        settled: true,
        proofId: "0x...",
        blockHeight: 51208621,
        signer: env.payTo
      }
    }, null, 2),
    "```",
    ""
  ].join("\n");
}

export function agentsTxt(env: OracleEnv): string {
  return [
    `# agents.txt for ${SERVICE.slug}`,
    `User-agent: *`,
    `Allow: /`,
    `Allow: /.well-known/`,
    `Allow: /llms.txt`,
    `Allow: /llms-full.txt`,
    `Allow: /agents.txt`,
    `Allow: /openapi.json`,
    `Allow: /api/health`,
    `Allow: /api/pricing`,
    `Disallow: /v1/demo/mint-payment`,
    "",
    `# Agent Protocol Endpoints`,
    `Agent-Card: ${env.publicBaseUrl}/.well-known/agent-card.json`,
    `MCP: ${env.publicBaseUrl}/mcp`,
    `Catalog: ${env.publicBaseUrl}/.well-known/x402`,
    `OpenAPI: ${env.publicBaseUrl}/openapi.json`,
    `LLMS-Txt: ${env.publicBaseUrl}/llms.txt`,
    `LLMS-Full: ${env.publicBaseUrl}/llms-full.txt`,
    "",
    `# Settlement & Payment Details`,
    `Payment-Protocol: x402`,
    `Payment-Version: 2`,
    `Payment-Network: ${env.network}`,
    `Payment-Asset: ${usdcForNetwork(env.network)}`,
    `Pay-To: ${env.payTo}`,
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
      ...(paid ? { "x-payment-info": paymentInfo, security: [{ x402Payment: [] }] } : {}),
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
    servers: [
      {
        url: env.publicBaseUrl,
        description: env.demoMode ? "Development / Demo Server" : "Production Server (Base Mainnet)",
      },
    ],
    tags: [
      { name: "health", description: "Liveness and seller posture checks" },
      { name: "pricing", description: "Pricing menu and connection instructions" },
      { name: "oracle", description: "Paid expert consultation tools" },
      { name: "a2a", description: "Autonomous outcome-driven tasks" },
    ],
    components: {
      securitySchemes: {
        x402Payment: {
          type: "apiKey",
          name: "PAYMENT-SIGNATURE",
          in: "header",
          description: "x402 v2 payment signature containing EIP-712 payment authorization payload.",
        },
      },
    },
    paths,
  };
}

export function jsonLd(env: OracleEnv) {
  const orgId = `${env.publicBaseUrl}/#organization`;
  const offers = TOOLS.map((t) => {
    const isPaid = t.tier === "paid";
    const price = isPaid ? clampPrice(t, undefined, env.maxPriceUsd) : 0;
    return {
      "@type": "Offer",
      name: t.serviceName,
      description: t.description,
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${env.publicBaseUrl}${t.httpPath}`,
      seller: { "@id": orgId },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: price.toFixed(2),
        priceCurrency: "USD",
        unitText: isPaid ? "per consult" : "free",
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Local AI Integrations",
        url: env.publicBaseUrl,
        logo: `${env.publicBaseUrl}/icon.svg`,
        description: "Decentralized machine-to-machine integrations and autonomous agent payment rails on Base.",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${env.publicBaseUrl}/#software`,
        name: SERVICE.name,
        alternateName: "x402 Oracle Wisdom Market",
        applicationCategory: "DeveloperApplication, BlockchainApplication, AIApplication",
        operatingSystem: "All (HTTP, JSON-RPC, MCP, Agent-to-Agent)",
        description: `${SERVICE.thesis} Paid & Free MCP + HTTP 402 wisdom market for x402, MCP, A2A, and Bazaar autonomous agents on Base USDC (eip155:8453). Autonomous state verification, attestation, and diagnostics.`,
        url: env.publicBaseUrl,
        softwareVersion: SERVICE.version,
        publisher: { "@id": orgId },
        author: { "@id": orgId },
        offers,
      },
      {
        "@type": "WebAPI",
        "@id": `${env.publicBaseUrl}/#webapi`,
        name: `${SERVICE.name} Web API & Model Context Protocol Server`,
        description: "Machine-payable HTTP 402 REST and Streamable HTTP MCP endpoints for AI agent wisdom, diagnostics, and Bazaar listings on Base USDC.",
        url: `${env.publicBaseUrl}/openapi.json`,
        documentation: `${env.publicBaseUrl}/llms.txt`,
        termsOfService: `${env.publicBaseUrl}/.well-known/funding.json`,
        provider: { "@id": orgId },
        serviceUrl: `${env.publicBaseUrl}/mcp`,
        potentialAction: [
          {
            "@type": "Action",
            name: "Health Check",
            target: `${env.publicBaseUrl}/api/health`,
          },
          {
            "@type": "Action",
            name: "Pricing Discovery",
            target: `${env.publicBaseUrl}/api/pricing`,
          },
          {
            "@type": "Action",
            name: "x402 Consult",
            target: `${env.publicBaseUrl}/api/consult/oracle_ask`,
          },
          {
            "@type": "Action",
            name: "MCP Streamable HTTP",
            target: `${env.publicBaseUrl}/mcp`,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${env.publicBaseUrl}/#service`,
        name: `${SERVICE.name} Attestation & Consult Service`,
        serviceType: "Blockchain Oracle & AI Agent Attestation Service",
        description: "Autonomous agent consultative oracle providing 402 handshake diagnostics, MCP review, and Bazaar ranking optimizations settling in Base USDC.",
        provider: { "@id": orgId },
        termsOfService: `${env.publicBaseUrl}/.well-known/funding.json`,
        areaServed: "Global",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "x402 Oracle Consult Tools",
          itemListElement: TOOLS.map((t, idx) => ({
            "@type": "OfferCatalog",
            name: t.serviceName,
            position: idx + 1,
            description: t.description,
          })),
        },
      },
      {
        "@type": "Dataset",
        "@id": `${env.publicBaseUrl}/#dataset`,
        name: `${SERVICE.name} Protocol Discovery Schemas & Machine Manifests`,
        description: "Machine-readable schemas, MCP manifests, agent cards, OpenAPI 3.1 definitions, and LLM text specs for autonomous agent discovery.",
        url: `${env.publicBaseUrl}/.well-known/x402`,
        creator: { "@id": orgId },
        distribution: [
          {
            "@type": "DataDownload",
            encodingFormat: "text/plain",
            contentUrl: `${env.publicBaseUrl}/llms.txt`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "text/plain",
            contentUrl: `${env.publicBaseUrl}/agents.txt`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${env.publicBaseUrl}/.well-known/x402`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${env.publicBaseUrl}/.well-known/agent-card.json`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${env.publicBaseUrl}/.well-known/mcp.json`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${env.publicBaseUrl}/openapi.json`,
          },
        ],
      },
    ],
  };
}

export { BASE_USDC };
