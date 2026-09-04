import { NextResponse } from "next/server";
import { openApi } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(openApi(oracleEnv()));
}
