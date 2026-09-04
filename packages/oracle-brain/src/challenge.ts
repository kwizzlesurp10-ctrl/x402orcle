import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { PAID_TOOLS, type OracleToolSpec } from "./catalog.js";
import { usdToAtomic, usdcForNetwork, type OracleEnv } from "./env.js";
import { clampPrice } from "./catalog.js";

export type PaymentAccept = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: "USDC"; version: "2" };
};

export type BazaarExtension = {
  bazaar: {
    info: Record<string, unknown>;
    schema?: Record<string, unknown>;
  };
};

export type PaymentRequired = {
  x402Version: 2;
  error: "PAYMENT_REQUIRED";
  accepts: PaymentAccept[];
  resource: {
    url: string;
    description: string;
    mimeType: "application/json";
    serviceName: string;
    tags: string[];
  };
  extensions: BazaarExtension;
};

function inputSchemaFor(tool: OracleToolSpec): {
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
} {
  const keys = Object.keys(tool.inputExample);
  const properties: Record<string, { type: string; description?: string }> = {};
  for (const k of keys) {
    const v = tool.inputExample[k];
    properties[k] = {
      type: Array.isArray(v) ? "array" : typeof v === "number" ? "number" : "string",
    };
  }
  return {
    properties,
    required: keys.length ? [keys[0]!] : undefined,
  };
}

export function bazaarForTool(tool: OracleToolSpec, transport: "http" | "mcp"): BazaarExtension {
  if (transport === "mcp") {
    return declareDiscoveryExtension({
      toolName: tool.name,
      description: tool.description.slice(0, 500),
      transport: "streamable-http",
      inputSchema: inputSchemaFor(tool),
      example: tool.inputExample,
      output: { example: tool.outputExample },
    }) as BazaarExtension;
  }
  const isGet = tool.httpMethod === "GET";
  return declareDiscoveryExtension({
    method: tool.httpMethod,
    ...(isGet ? {} : { bodyType: "json" as const }),
    input: tool.inputExample,
    inputSchema: inputSchemaFor(tool),
    output: { example: tool.outputExample },
  }) as BazaarExtension;
}

export function buildAccept(env: OracleEnv, priceUsd: number): PaymentAccept {
  return {
    scheme: "exact",
    network: env.network,
    amount: usdToAtomic(priceUsd),
    asset: usdcForNetwork(env.network),
    payTo: env.payTo,
    maxTimeoutSeconds: 60,
    extra: { name: "USDC", version: "2" },
  };
}

export function buildPaymentRequired(opts: {
  env: OracleEnv;
  tool: OracleToolSpec;
  priceUsd: number;
  transport?: "http" | "mcp";
}): PaymentRequired {
  const transport = opts.transport ?? "http";
  const url =
    transport === "mcp"
      ? `mcp://tool/${opts.tool.name}`
      : `${opts.env.publicBaseUrl}${opts.tool.httpPath}`;
  return {
    x402Version: 2,
    error: "PAYMENT_REQUIRED",
    accepts: [buildAccept(opts.env, opts.priceUsd)],
    resource: {
      url,
      description: opts.tool.description.slice(0, 500),
      mimeType: "application/json",
      serviceName: opts.tool.serviceName.slice(0, 32),
      tags: opts.tool.tags.slice(0, 5),
    },
    extensions: bazaarForTool(opts.tool, transport),
  };
}

export function encodePaymentRequired(pr: PaymentRequired): string {
  return Buffer.from(JSON.stringify(pr), "utf8").toString("base64");
}

export function decodePaymentHeader(header: string | undefined): unknown | null {
  if (!header) return null;
  try {
    const raw = header.trim().startsWith("{")
      ? header
      : Buffer.from(header, "base64").toString("utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function paidCatalogRequired(env: OracleEnv): PaymentRequired[] {
  return PAID_TOOLS.map((tool) =>
    buildPaymentRequired({
      env,
      tool,
      priceUsd: clampPrice(tool, undefined, env.maxPriceUsd),
    }),
  );
}
