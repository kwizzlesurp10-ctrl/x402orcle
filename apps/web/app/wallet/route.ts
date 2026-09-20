import { NextResponse } from "next/server";
import { DEFAULT_PAY_TO } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../../lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = oracleEnv();
  return NextResponse.json(
    {
      receive_address: env.payTo,
      default_pay_to: DEFAULT_PAY_TO,
      pay_to_retired_warning: env.payToRetiredWarning,
      network: env.network,
      note: "Private keys stay in server env; this endpoint never returns key material.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
