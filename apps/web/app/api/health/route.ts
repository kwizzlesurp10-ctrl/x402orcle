import { NextResponse } from "next/server";
import { SERVICE } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";
export function GET() {
  const env = oracleEnv();
  return NextResponse.json({
    ok: true,
    service: SERVICE.name,
    slug: SERVICE.slug,
    wallet_configured: false,
    pay_to_configured: true,
    seller_leak_warning: env.sellerLeakWarning,
    demoMode: env.demoMode,
    network: env.network,
    thesis: SERVICE.thesis,
  });
}
