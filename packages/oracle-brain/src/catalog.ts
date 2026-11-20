export type ToolTier = "free" | "paid";

export type JsonSchemaProperty = {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  format?: string;
  items?: { type: string; description?: string };
  additionalProperties?: boolean | Record<string, unknown>;
};

export type ToolJsonSchema = {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolAnnotations = {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

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
  inputSchema: ToolJsonSchema;
  outputSchema: ToolJsonSchema;
  annotations: McpToolAnnotations;
  inputExample: Record<string, unknown>;
  outputExample: Record<string, unknown>;
};

export const SERVICE = {
  slug: "x402orcle",
  name: "x402 Oracle",
  version: "0.2.1",
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
    description:
      "Check x402 Oracle server health, configured Base payTo posture, facilitator mode (demo or live), and seller-key safety flags. Free and read-only; requires no arguments or payment header. Use this before calling paid consult tools to verify availability; use oracle_pricing to inspect USD fees.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean", description: "True when the Oracle server is healthy and accepting requests." },
        service: { type: "string", description: "Display name of the Oracle service." },
        slug: { type: "string", description: "Canonical server slug (x402orcle)." },
        version: { type: "string", description: "Running service semver string." },
        wallet_configured: { type: "boolean", description: "Always false on seller-only hosts (no spend key stored)." },
        pay_to_configured: { type: "boolean", description: "True when a valid 42-char settlement address is configured." },
        cdp_auth_configured: { type: "boolean", description: "True when Coinbase CDP facilitator JWT credentials are configured." },
        seller_leak_warning: { type: "boolean", description: "True only if a dangerous buyer private key was detected in seller env." },
        demoMode: { type: "boolean", description: "True when running with local DemoFacilitator verification." },
        network: { type: "string", description: "CAIP-2 settlement network identifier (e.g. eip155:8453)." },
        thesis: { type: "string", description: "Service thesis motto." },
      },
      required: ["ok", "service", "slug", "version", "network"],
    },
    annotations: {
      title: "Oracle Health Check",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description:
      "List all free and paid x402 Oracle endpoints, current clamped USDC prices on Base, max price ceiling, and connection instructions. Free and read-only; takes no parameters. Call this instead of oracle_health when selecting a paid consult tool and budgeting payment amount.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        maxPriceUsd: { type: "number", description: "Upper USD price cap enforced on all consults." },
        network: { type: "string", description: "CAIP-2 settlement network (eip155:8453)." },
        payTo: { type: "string", description: "Recipient USDC address on Base." },
        connect: { type: "object", description: "Instructions for connecting over HTTP 402, MCP, and A2A." },
        free: { type: "array", description: "List of free tool descriptors.", items: { type: "object" } },
        paid: { type: "array", description: "List of paid tool descriptors with priceUsd.", items: { type: "object" } },
      },
      required: ["maxPriceUsd", "network", "payTo", "free", "paid"],
    },
    annotations: {
      title: "Oracle Pricing Menu",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
      "Ask a general architectural or ranking question about x402 micropayments, MCP monetization, A2A agent cards, or CDP Bazaar discovery ($0.10 USDC on Base). Unpaid calls return an HTTP 402 challenge envelope (`isError: true`); retry with `_meta['x402/payment']`. Use oracle_diagnose_402 instead to inspect a raw PAYMENT-REQUIRED header.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          minLength: 1,
          description: "Specific technical question on x402 wire format, MCP payment wrapping, A2A discovery, or Bazaar ranking.",
        },
        audience: {
          type: "string",
          enum: ["agent", "developer", "operator"],
          default: "agent",
          description: "Target framing for the returned verdict and implementation prompt ('agent', 'developer', or 'operator').",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        verdict: { type: "string", description: "Short machine-readable classification of the root cause or answer." },
        wisdom: { type: "string", description: "Concise domain guidance grounded in x402/Bazaar production rules." },
        implementation_prompt: { type: "string", description: "Ready-to-run SYSTEM/USER developer prompt to apply the fix." },
        risk: { type: "string", description: "Primary operational or financial failure mode to avoid." },
        citations: { type: "array", description: "Authoritative documentation URLs.", items: { type: "string" } },
        receipt: { type: "object", description: "Verified x402 or demo settlement receipt metadata." },
      },
      required: ["verdict", "wisdom", "risk", "citations"],
    },
    annotations: {
      title: "Oracle General Consult ($0.10)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputExample: {
      question: "Why is my Bazaar listing unranked after 402s with no settlement?",
      audience: "agent",
    },
    outputExample: {
      verdict: "no_rank_without_settle",
      wisdom: "Cataloging is settlement-triggered.",
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
      "Decode and audit an HTTP 402 PAYMENT-REQUIRED header (base64 or JSON) for accepts[], Base USDC terms, extensions.bazaar schema validity, and resource.url alignment ($0.50 USDC on Base). Unpaid calls return 402 terms. Use this instead of oracle_review_mcp when debugging a single 402 payload before facilitator settlement.",
    inputSchema: {
      type: "object",
      properties: {
        challenge_b64_or_json: {
          type: "string",
          minLength: 1,
          description: "Raw base64-encoded PAYMENT-REQUIRED header value or its decoded JSON string.",
        },
        resource_url: {
          type: "string",
          format: "uri",
          description: "Optional canonical HTTPS URL of the protected endpoint being challenged.",
        },
      },
      required: ["challenge_b64_or_json"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        verdict: { type: "string", description: "Diagnosis code such as challenge_shape_ok, missing_bazaar_extension, or missing_accepts." },
        wisdom: { type: "string", description: "Actionable explanation of what passed or failed in the 402 handshake." },
        implementation_prompt: { type: "string", description: "Step-by-step repair instructions for the challenged endpoint." },
        risk: { type: "string", description: "Risk warning for malformed indexing or wasted settlement gas." },
        citations: { type: "array", description: "Coinbase CDP validate and Bazaar doc links.", items: { type: "string" } },
      },
      required: ["verdict", "wisdom"],
    },
    annotations: {
      title: "Diagnose HTTP 402 Challenge ($0.50)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputExample: {
      challenge_b64_or_json: "eyJ4NDAyVmVyc2lvbiI6Mn0=",
      resource_url: "https://example.com/paid",
    },
    outputExample: {
      verdict: "missing_bazaar_extension",
      wisdom:
        "A live 402 must be standard base64 JSON with accepts[] (scheme exact, network eip155:8453, Base USDC) and extensions.bazaar.info.input.method.",
    },
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
      "Audit a paid MCP server architecture for x402 payment wrapping, declareDiscoveryExtension metadata, free health tooling, Streamable HTTP compliance, and seller-key isolation ($3.00 USDC on Base). Unpaid calls return 402 terms. Use oracle_bazaar_rewrite for listing copy or oracle_diagnose_402 for single header checks.",
    inputSchema: {
      type: "object",
      properties: {
        mcp_url: {
          type: "string",
          minLength: 1,
          description: "Public MCP endpoint URL or deployment path under review (e.g. 'https://example.com/mcp').",
        },
        notes: {
          type: "string",
          description: "Optional transport, runtime, and paid tool summary (e.g. 'streamable-http, two paid tools').",
        },
      },
      required: ["mcp_url"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        verdict: { type: "string", description: "Architectural review verdict summarizing required gaps." },
        wisdom: { type: "string", description: "Best-practice design checklist for Bazaar-ready paid MCP servers." },
        implementation_prompt: { type: "string", description: "Targeted code refactor plan for the audited MCP server." },
        risk: { type: "string", description: "Deployment and key-exposure hazards detected." },
        citations: { type: "array", description: "x402 MCP server reference links.", items: { type: "string" } },
      },
      required: ["verdict", "wisdom"],
    },
    annotations: {
      title: "Review Paid MCP Server ($3.00)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputExample: {
      mcp_url: "https://example.com/mcp",
      notes: "streamable-http, two paid tools",
    },
    outputExample: {
      verdict: "needs_free_health_tool",
      wisdom:
        "A Bazaar-ready paid MCP server must expose createPaymentWrapper (or equivalent), x402ResourceServer on eip155:8453, declareDiscoveryExtension with toolName, a free health tool, paid consults, and streamable-http at /mcp.",
    },
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
      "Generate SEO-optimized CDP Bazaar metadata (serviceName <=32 chars, description <=500 chars, <=5 tags) front-loaded with buyer search phrases and first-index freeze warnings ($1.50 USDC on Base). Unpaid calls return 402 terms. Use this before settling a new SKU; for broader launch diffs use complete_oracle_task.",
    inputSchema: {
      type: "object",
      properties: {
        current_description: {
          type: "string",
          description: "Optional existing Bazaar resource description to rewrite for higher buyer-query match.",
        },
        buyer_phrases: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of target buyer search queries to front-load into serviceName and description.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        verdict: { type: "string", description: "Rewrite readiness and freeze-avoidance verdict." },
        wisdom: { type: "string", description: "Explanation of CDP Bazaar ranking and first-index copy freeze." },
        agent: {
          type: "object",
          description: "Machine-ready object containing serviceName, description, and tags.",
        },
        implementation_prompt: { type: "string", description: "Prompt to apply the updated Bazaar metadata cleanly." },
        risk: { type: "string", description: "Pricing threshold and catalog freeze risks." },
      },
      required: ["verdict", "wisdom"],
    },
    annotations: {
      title: "Rewrite Bazaar Discovery Metadata ($1.50)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputExample: {
      current_description: "API for data",
      buyer_phrases: ["x402 mcp oracle", "paid mcp bazaar"],
    },
    outputExample: {
      serviceName: "x402 MCP Oracle",
      description: "Paid MCP consults for x402, Bazaar ranking, A2A tasks, burner isolation.",
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
      "Execute a high-depth outcome planning task delivering typed diffs, security constraints, operator handoff checklists, and ship verification steps for an x402 production launch goal ($10.00 USDC on Base). Unpaid calls return 402 terms. Use for end-to-end delivery plans; use oracle_ask ($0.10) for shorter Q&A.",
    inputSchema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          minLength: 1,
          description: "Concrete production delivery objective (e.g. 'List oracle_ask on CDP Bazaar after first mainnet settle').",
        },
        constraints: {
          type: "string",
          description: "Optional security, budget, or hosting constraints (e.g. 'seller-only host, no EVM_PRIVATE_KEY').",
        },
      },
      required: ["goal"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        verdict: { type: "string", description: "Outcome ship classification." },
        wisdom: { type: "string", description: "End-to-end operational runbook from validation through settlement." },
        implementation_prompt: { type: "string", description: "Comprehensive execution prompt enforcing seller safety." },
        risk: { type: "string", description: "Key deployment, facilitator, or settlement hazards." },
        citations: { type: "array", description: "Supporting x402 protocol documentation links.", items: { type: "string" } },
      },
      required: ["verdict", "wisdom"],
    },
    annotations: {
      title: "Complete Outcome Task Plan ($10.00)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputExample: {
      goal: "List oracle_ask on CDP Bazaar after first mainnet settle",
      constraints: "seller-only host, no EVM_PRIVATE_KEY",
    },
    outputExample: {
      verdict: "ship_seed_settle",
      wisdom:
        "Outcome task: deploy HTTPS → GET 402 crawler on every paid POST → CDP validate → one seed settle from a local burner with USDC on Base → confirm discovery/search.",
    },
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

/** Canonical MCP tools/list payload with rich schemas, outputSchema, and routing annotations. */
export function mcpToolDefinitions() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    outputSchema: t.outputSchema,
    annotations: t.annotations,
  }));
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
