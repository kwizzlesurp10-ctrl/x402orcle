import { llmsTxt } from "@x402orcle/oracle-brain";
import { oracleEnv } from "../../lib/env";

export const dynamic = "force-dynamic";
export function GET() {
  return new Response(llmsTxt(oracleEnv()), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
