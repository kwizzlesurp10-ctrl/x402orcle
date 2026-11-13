import { NextResponse } from "next/server";
import { consultApiIndex } from "@x402orcle/oracle-brain";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(consultApiIndex(), { status: 404 });
}

export function POST() {
  return NextResponse.json(consultApiIndex(), { status: 404 });
}
