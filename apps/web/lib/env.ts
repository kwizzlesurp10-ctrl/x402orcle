import { loadEnv, type OracleEnv } from "@x402orcle/oracle-brain";

let cached: OracleEnv | null = null;

function publicBase(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

export function oracleEnv(): OracleEnv {
  if (cached) return cached;
  cached = loadEnv({
    ...process.env,
    X402_PAY_TO:
      process.env.X402_PAY_TO ||
      process.env.X402_PAY_TO_ADDRESS ||
      "0xAB745e5F576667037696e78ba7dA28E193E4423D",
    DEMO_MODE: process.env.DEMO_MODE ?? "true",
    PUBLIC_BASE_URL: publicBase(),
  });
  return cached;
}
