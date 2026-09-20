import { loadEnv, type OracleEnv, DEFAULT_PAY_TO } from "@x402orcle/oracle-brain";

let cached: OracleEnv | null = null;

function publicBase(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3001";
}

export function oracleEnv(): OracleEnv {
  if (cached) return cached;
  cached = loadEnv({
    ...process.env,
    X402_PAY_TO:
      process.env.X402_PAY_TO ||
      process.env.X402_PAY_TO_ADDRESS ||
      DEFAULT_PAY_TO,
    DEMO_MODE: process.env.DEMO_MODE ?? "true",
    PUBLIC_BASE_URL: publicBase(),
  });
  return cached;
}
