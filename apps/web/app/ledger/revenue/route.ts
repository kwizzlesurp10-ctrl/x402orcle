import { NextRequest, NextResponse } from "next/server";
import { readRevenue } from "@x402orcle/oracle-brain";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 1000);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 5000) : 1000;
  return NextResponse.json(readRevenue(limit), {
    headers: { "Cache-Control": "no-store" },
  });
}
