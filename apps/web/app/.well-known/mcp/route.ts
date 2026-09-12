import { NextResponse } from "next/server";
import { mcpJson } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(mcpJson(oracleEnv()), {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
}
