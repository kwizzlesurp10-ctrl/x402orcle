import { NextResponse } from "next/server";
import { wellKnownX402 } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(wellKnownX402(oracleEnv()));
}
