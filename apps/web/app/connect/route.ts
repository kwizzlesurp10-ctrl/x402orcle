import { NextResponse } from "next/server";
import { connectDocument } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

export function GET() {
  return NextResponse.json(connectDocument(oracleEnv()), { headers });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers });
}
