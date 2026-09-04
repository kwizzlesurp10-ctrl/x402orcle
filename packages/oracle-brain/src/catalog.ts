export type ToolTier = "free" | "paid";

export type OracleToolSpec = {
  name: string;
  httpPath: string;
  httpMethod: "GET" | "POST";
  tier: ToolTier;
  priceUsd: number;
  priceMinUsd: number;
  priceMaxUsd: number;
  serviceName: string;
  tags: string[];
  description: string;
  inputExample: Record<string, unknown>;
  outputExample: Record<string, unknown>;
};

export const SERVICE = {
  slug: "x402orcle",
  name: "x402 Oracle",
  version: "0.1.0",
  thesis: "402 is the answer. The Oracle is how you ask.",
} as const;

export const TOOLS: OracleToolSpec[] = [
  {
    name: "oracle_health",
    httpPath: "/api/health",
    httpMethod: "GET",
    tier: "free",
    priceUsd: 0,
    priceMinUsd: 0,
    priceMaxUsd: 0,
    serviceName: "Oracle Health",
    tags: ["x402", "oracle", "health"],
    description: "Free liveness + seller posture (payTo configured, no spend key, network, demo/live).",
    inputExample: {},
    outputExample: {
      ok: true,
      service: "x402 Oracle",
      wallet_configured: false,
      pay_to_configured: true,
      network: "eip155:8453",
    },
  },
  {
    name: "oracle_pricing",
    httpPath: "/api/pricing",
    httpMethod: "GET",
    tier: "free",
    priceUsd: 0,
    priceMinUsd: 0,
    priceMaxUsd: 0,
    serviceName: "Oracle Pricing",
    tags: ["x402", "oracle", "pricing"],
    description: "Free menu of paid consults, A2A tasks, and connect how-to. No keys requested.",
    inputExample: {},
    outputExample: { tools: [], maxPriceUsd: 25, network: "eip155:8453" },
  },
  {
    name: "oracle_ask",
    httpPath: "/api/consult/oracle_ask",
    httpMethod: "POST",
    tier: "paid",
    priceUsd: 0.1,
    priceMinUsd: 0.05,
    priceMaxUsd: 0.15,
    serviceName: "Oracle Ask",
    tags: ["x402", "mcp", "a2a", "bazaar", "oracle"],
    description:
      "Paid x402/MCP/A2A/Bazaar consult. Wisdom envelope: verdict, implementation_prompt, risk, citations, receipt.",
    inputExample: {
      question: "Why is my Bazaar listing unranked after 402s with no settlement?",
      audience: "agent",
    },
    outputExample: {
      verdict: "no_rank_without_settle",
      wisdom: "Cataloging is settlement-triggered.",
      implementation_prompt: "…",
      risk: "burning USDC on frozen catalog copy",
      citations: ["https://docs.cdp.coinbase.com/x402/seller/get-discovered"],
    },
  },
  {
    name: "oracle_diagnose_402",
    httpPath: "/api/consult/oracle_diagnose_402",
    httpMethod: "POST",
    tier: "paid",
    priceUsd: 0.5,
    priceMinUsd: 0.25,
    priceMaxUsd: 0.75,
    serviceName: "Diagnose 402",
    tags: ["x402", "402", "facilitator", "oracle"],
    description:
      "Post-mortem a 402 handshake: PAYMENT-REQUIRED shape, bazaar extension, network, asset, resource.url.",
    inputExample: {
      challenge_b64_or_json: "eyJ4NDAyVmVyc2lvbiI6Mn0=",
      resource_url: "https://example.com/paid",
    },
    outputExample: { verdict: "missing_bazaar_extension", wisdom: "…" },
  },
  {
    name: "oracle_review_mcp",
    httpPath: "/api/consult/oracle_review_mcp",
    httpMethod: "POST",
    tier: "paid",
    priceUsd: 3,
    priceMinUsd: 1.5,
    priceMaxUsd: 8,
    serviceName: "Review MCP",
    tags: ["mcp", "x402", "paid-tools", "oracle"],
    description:
      "Review an MCP paid-tool server for createPaymentWrapper, free health tool, discovery extension, burner isolation.",
    inputExample: {
      mcp_url: "https://example.com/mcp",
      notes: "streamable-http, two paid tools",
    },
    outputExample: { verdict: "needs_free_health_tool", wisdom: "…" },
  },
  {
    name: "oracle_bazaar_rewrite",
    httpPath: "/api/consult/oracle_bazaar_rewrite",
    httpMethod: "POST",
    tier: "paid",
    priceUsd: 1.5,
    priceMinUsd: 0.75,
    priceMaxUsd: 3,
    serviceName: "Bazaar Rewrite",
    tags: ["bazaar", "cdp", "ranking", "oracle"],
    description:
      "Rewrite serviceName (≤32), description (≤500), tags (≤5) for buyer-query rank. Warns on first-index freeze.",
    inputExample: {
      current_description: "API for data",
      buyer_phrases: ["x402 mcp oracle", "paid mcp bazaar"],
    },
    outputExample: {
      serviceName: "x402 MCP Oracle",
      description: "…",
      tags: ["x402", "mcp", "bazaar"],
    },
  },
  {
    name: "complete_oracle_task",
    httpPath: "/api/consult/complete_oracle_task",
    httpMethod: "POST",
    tier: "paid",
    priceUsd: 10,
    priceMinUsd: 5,
    priceMaxUsd: 25,
    serviceName: "Oracle Task",
    tags: ["a2a", "outcome", "x402", "oracle"],
    description:
      "Outcome A2A task: typed diffs + operator prompt + revenue/risk for a concrete x402 shipping goal.",
    inputExample: {
      goal: "List oracle_ask on CDP Bazaar after first mainnet settle",
      constraints: "seller-only host, no EVM_PRIVATE_KEY",
    },
    outputExample: { verdict: "ship_seed_settle", wisdom: "…" },
  },
];

export const FREE_TOOLS = TOOLS.filter((t) => t.tier === "free");
export const PAID_TOOLS = TOOLS.filter((t) => t.tier === "paid");

export function jsonSchemaFromExample(example: Record<string, unknown>): {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
} {
  const properties: Record<string, { type: string; description?: string }> = {};
  for (const [k, v] of Object.entries(example)) {
    properties[k] = {
      type: Array.isArray(v) ? "array" : typeof v === "number" ? "number" : "string",
    };
  }
  const keys = Object.keys(properties);
  return {
    type: "object",
    properties,
    ...(keys.length ? { required: [keys[0]!] } : {}),
  };
}

export function getTool(name: string): OracleToolSpec | undefined {
  return TOOLS.find((t) => t.name === name);
}

export function requireTool(name: string): OracleToolSpec {
  const t = getTool(name);
  if (!t) throw new Error(`UNKNOWN_TOOL:${name}`);
  return t;
}

export function clampPrice(tool: OracleToolSpec, requested: number | undefined, maxPriceUsd: number): number {
  const base = requested ?? tool.priceUsd;
  const lo = tool.priceMinUsd;
  const hi = Math.min(tool.priceMaxUsd, maxPriceUsd);
  if (base < lo) return lo;
  if (base > hi) return hi;
  return base;
}
