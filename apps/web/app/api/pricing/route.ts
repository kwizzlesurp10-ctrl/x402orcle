import { NextResponse } from "next/server";
import { FREE_TOOLS, PAID_TOOLS, clampPrice, ORACLE_CONNECT_HOWTO } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const env = oracleEnv();
  return NextResponse.json(
    {
      maxPriceUsd: env.maxPriceUsd,
      network: env.network,
      payTo: env.payTo,
      connect: ORACLE_CONNECT_HOWTO,
      free: FREE_TOOLS.map((t) => ({ name: t.name, path: t.httpPath })),
      paid: PAID_TOOLS.map((t) => ({
        name: t.name,
        path: t.httpPath,
        method: t.httpMethod,
        priceUsd: clampPrice(t, undefined, env.maxPriceUsd),
      })),
    },
    {
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
        "access-control-allow-origin": "*",
      },
    },
  );
}
