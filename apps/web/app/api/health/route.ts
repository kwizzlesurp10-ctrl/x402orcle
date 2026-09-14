import { NextResponse } from "next/server";
import { SERVICE } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const env = oracleEnv();
  const now = new Date().toISOString();
  return NextResponse.json(
    {
      ok: true,
      status: "operational",
      timestamp: now,
      service: SERVICE.name,
      slug: SERVICE.slug,
      version: SERVICE.version,
      x402_version: 2,
      pay_to: env.payTo,
      wallet_configured: false,
      pay_to_configured: true,
      cdp_auth_configured: Boolean(env.cdpApiKeyId && env.cdpApiKeySecret),
      seller_leak_warning: env.sellerLeakWarning,
      demoMode: env.demoMode,
      network: env.network,
      asset: env.network.includes("84532")
        ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
        : "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      thesis: SERVICE.thesis,
    },
    {
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        "access-control-allow-origin": "*",
      },
    },
  );
}
