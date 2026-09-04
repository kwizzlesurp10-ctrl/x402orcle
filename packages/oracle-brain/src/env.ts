import { z } from "zod";

const ADDRESS = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "X402_PAY_TO must be a 20-byte address (0x + 40 hex), never a private key");

const PRIVATE_KEY_SHAPE = /^0x[a-fA-F0-9]{64}$/;

export const EnvSchema = z
  .object({
    PUBLIC_BASE_URL: z.string().min(1).default("http://127.0.0.1:4021"),
    X402_PAY_TO: z.string().optional(),
    X402_PAY_TO_ADDRESS: z.string().optional(),
    X402_NETWORK: z.string().default("eip155:8453"),
    X402_FACILITATOR_URL: z
      .string()
      .default("https://api.cdp.coinbase.com/platform/v2/x402"),
    X402_FACILITATOR_URL_FALLBACK: z.string().optional(),
    MAX_PRICE_USD: z.coerce.number().positive().max(100).default(25),
    DEMO_MODE: z
      .string()
      .optional()
      .transform((v) => ["1", "true", "yes", "on"].includes((v ?? "true").toLowerCase())),
    PORT: z.coerce.number().int().positive().default(4021),
    HOST: z.string().default("127.0.0.1"),
    ORACLE_LLM_API_KEY: z.string().optional(),
    ORACLE_LLM_BASE_URL: z.string().optional(),
    ORACLE_LLM_MODEL: z.string().optional(),
    EVM_PRIVATE_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const payTo = data.X402_PAY_TO || data.X402_PAY_TO_ADDRESS;
    if (!payTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "X402_PAY_TO is required (seller receive address)",
        path: ["X402_PAY_TO"],
      });
      return;
    }
    if (PRIVATE_KEY_SHAPE.test(payTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "X402_PAY_TO looks like a private key. Use the 42-char address only.",
        path: ["X402_PAY_TO"],
      });
    }
    const parsed = ADDRESS.safeParse(payTo);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: parsed.error.issues[0]?.message ?? "invalid payTo",
        path: ["X402_PAY_TO"],
      });
    }
  });

export type RawEnv = z.infer<typeof EnvSchema>;

export type OracleEnv = {
  publicBaseUrl: string;
  payTo: `0x${string}`;
  network: string;
  facilitatorUrl: string;
  facilitatorFallback?: string;
  maxPriceUsd: number;
  demoMode: boolean;
  port: number;
  host: string;
  llmApiKey?: string;
  llmBaseUrl: string;
  llmModel: string;
  sellerLeakWarning: boolean;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): OracleEnv {
  const parsed = EnvSchema.parse(source);
  const payTo = (parsed.X402_PAY_TO || parsed.X402_PAY_TO_ADDRESS)!;
  const sellerLeakWarning = Boolean(parsed.EVM_PRIVATE_KEY && parsed.EVM_PRIVATE_KEY.length > 0);
  return {
    publicBaseUrl: parsed.PUBLIC_BASE_URL.replace(/\/$/, ""),
    payTo: payTo as `0x${string}`,
    network: parsed.X402_NETWORK,
    facilitatorUrl: parsed.X402_FACILITATOR_URL,
    facilitatorFallback: parsed.X402_FACILITATOR_URL_FALLBACK,
    maxPriceUsd: parsed.MAX_PRICE_USD,
    demoMode: Boolean(parsed.DEMO_MODE),
    port: parsed.PORT,
    host: parsed.HOST,
    llmApiKey: parsed.ORACLE_LLM_API_KEY,
    llmBaseUrl: parsed.ORACLE_LLM_BASE_URL || "https://api.x.ai/v1",
    llmModel: parsed.ORACLE_LLM_MODEL || "grok-4",
    sellerLeakWarning,
  };
}

export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export function usdcForNetwork(network: string): string {
  return network.includes("84532") ? BASE_SEPOLIA_USDC : BASE_USDC;
}

export function usdToAtomic(usd: number): string {
  return String(Math.round(usd * 1_000_000));
}
