import { NextResponse } from "next/server";
import { demandSnapshot } from "@x402orcle/oracle-brain";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(demandSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
