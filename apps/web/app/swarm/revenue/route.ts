import { NextResponse } from "next/server";
import { revenueSummary } from "@x402orcle/oracle-brain";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = revenueSummary();
  return NextResponse.json(
    {
      scope: "oracle_storefront",
      note: "Settled oracle consult revenue. Operator self-settles are not external demand.",
      ...summary,
      storefront: summary,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
